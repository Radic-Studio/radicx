import { mergeLocalSession, safeStudyPackage } from './study-state.js';

export const STUDY_DB_NAME = 'radicx-study';
export const STUDY_DB_VERSION = 1;
export const STUDY_DB_STORES = Object.freeze([
  'question_cache',
  'active_sessions',
  'answer_outbox',
  'bookmark_outbox',
  'app_meta'
]);

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Local Study storage request failed.'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Local Study storage transaction was cancelled.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('Local Study storage transaction failed.'));
  });
}

export function studyCacheKey(sessionId, position) {
  return `${sessionId}:${Number(position)}`;
}

export async function openStudyDb() {
  if (!globalThis.indexedDB) throw new Error('IndexedDB is unavailable in this browser.');
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(STUDY_DB_NAME, STUDY_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('question_cache')) db.createObjectStore('question_cache', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('active_sessions')) db.createObjectStore('active_sessions', { keyPath: 'sessionId' });
      if (!db.objectStoreNames.contains('answer_outbox')) db.createObjectStore('answer_outbox', { keyPath: 'operationId' });
      if (!db.objectStoreNames.contains('bookmark_outbox')) db.createObjectStore('bookmark_outbox', { keyPath: 'operationId' });
      if (!db.objectStoreNames.contains('app_meta')) db.createObjectStore('app_meta', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('RadicX could not open local Study storage.'));
    request.onblocked = () => reject(new Error('RadicX local Study storage is blocked by another tab.'));
  });
}

async function withTransaction(storeNames, mode, work) {
  const db = await openStudyDb();
  try {
    const transaction = db.transaction(storeNames, mode);
    const stores = Object.fromEntries(storeNames.map((name) => [name, transaction.objectStore(name)]));
    const result = await work(stores, transaction);
    await transactionDone(transaction);
    return result;
  } finally {
    db.close();
  }
}

async function getMeta(key) {
  return withTransaction(['app_meta'], 'readonly', async ({ app_meta: store }) => requestResult(store.get(key)));
}

export async function setMeta(key, value) {
  return withTransaction(['app_meta'], 'readwrite', async ({ app_meta: store }) => {
    store.put({ key, value, updatedAt: new Date().toISOString() });
  });
}

export async function deleteMeta(key) {
  return withTransaction(['app_meta'], 'readwrite', async ({ app_meta: store }) => {
    store.delete(key);
  });
}

async function clearStore(store) {
  store.clear();
}

export async function ensureStudyUser(userId) {
  const owner = await getMeta('owner_user_id');
  if (owner?.value === userId) return;

  await withTransaction(STUDY_DB_STORES, 'readwrite', async (stores) => {
    clearStore(stores.question_cache);
    clearStore(stores.active_sessions);
    clearStore(stores.answer_outbox);
    clearStore(stores.bookmark_outbox);
    clearStore(stores.app_meta);
    stores.app_meta.put({ key: 'owner_user_id', value: userId, updatedAt: new Date().toISOString() });
  });
}

export async function clearStudyWorkingState() {
  await withTransaction(STUDY_DB_STORES, 'readwrite', async (stores) => {
    for (const name of STUDY_DB_STORES) clearStore(stores[name]);
  });
}

export async function cacheStudyPackage(userId, packageData) {
  const safePackage = safeStudyPackage(packageData);
  if (!safePackage.session?.id) throw new Error('Cannot cache a Study package without a session ID.');
  await ensureStudyUser(userId);

  return withTransaction(['question_cache', 'active_sessions'], 'readwrite', async (stores) => {
    const existing = await requestResult(stores.active_sessions.get(safePackage.session.id));
    const merged = mergeLocalSession(safePackage, existing);
    merged.userId = userId;
    merged.updatedAt = new Date().toISOString();

    for (const question of safePackage.questions) {
      stores.question_cache.put({
        key: studyCacheKey(safePackage.session.id, question.position),
        userId,
        sessionId: safePackage.session.id,
        position: Number(question.position),
        question: { ...question },
        cachedAt: new Date().toISOString()
      });
    }
    stores.active_sessions.put(merged);
    return { package: safePackage, localSession: merged };
  });
}

export async function getCachedStudyPackage(userId, sessionId) {
  await ensureStudyUser(userId);
  return withTransaction(['question_cache', 'active_sessions'], 'readonly', async (stores) => {
    const localSession = await requestResult(stores.active_sessions.get(sessionId));
    if (!localSession || localSession.userId !== userId) return null;
    const all = await requestResult(stores.question_cache.getAll());
    const questions = all
      .filter((entry) => entry.userId === userId && entry.sessionId === sessionId)
      .sort((a, b) => a.position - b.position)
      .map((entry) => entry.question);
    return {
      session: {
        id: localSession.sessionId,
        study_kind: localSession.studyKind,
        subject_id: localSession.subjectId,
        topic_id: localSession.topicId,
        target_question_count: localSession.targetQuestionCount,
        current_position: localSession.localPosition,
        device_version: localSession.deviceVersion,
        status: localSession.status,
        started_at: localSession.startedAt,
        last_activity_at: localSession.lastActivityAt
      },
      questions,
      localSession
    };
  });
}

export async function getLocalSession(userId, sessionId) {
  await ensureStudyUser(userId);
  return withTransaction(['active_sessions'], 'readonly', async ({ active_sessions: store }) => {
    const value = await requestResult(store.get(sessionId));
    return value?.userId === userId ? value : null;
  });
}

export async function updateLocalSession(userId, sessionId, updater) {
  await ensureStudyUser(userId);
  return withTransaction(['active_sessions'], 'readwrite', async ({ active_sessions: store }) => {
    const current = await requestResult(store.get(sessionId));
    if (!current || current.userId !== userId) throw new Error('Local Study session is unavailable.');
    const updated = updater(structuredClone(current)) ?? current;
    updated.userId = userId;
    updated.sessionId = sessionId;
    updated.updatedAt = new Date().toISOString();
    store.put(updated);
    return updated;
  });
}

export async function setLocalPosition(userId, sessionId, position) {
  return updateLocalSession(userId, sessionId, (session) => {
    session.localPosition = Number(position);
    return session;
  });
}

export async function setLocalSelection(userId, sessionId, position, patch) {
  return updateLocalSession(userId, sessionId, (session) => {
    const key = String(position);
    const existing = session.items?.[key] ?? {};
    if (existing.submissionState && existing.submissionState !== 'draft') return session;
    session.items ??= {};
    session.items[key] = { ...existing, ...patch, submissionState: 'draft' };
    return session;
  });
}

export async function markLocalAnswerPending(userId, sessionId, position, operation) {
  return updateLocalSession(userId, sessionId, (session) => {
    const key = String(position);
    session.items ??= {};
    session.items[key] = {
      ...(session.items[key] ?? {}),
      selectedOption: operation.selectedOption,
      confidence: operation.confidence,
      submissionState: 'pending',
      feedback: null
    };
    return session;
  });
}

export async function applyServerAnswerResult(userId, operation, result) {
  return updateLocalSession(userId, operation.sessionId, (session) => {
    const key = String(operation.position);
    session.items ??= {};
    if (result?.status === 'evaluated') {
      session.items[key] = {
        ...(session.items[key] ?? {}),
        selectedOption: result.selected_option,
        confidence: result.confidence,
        submissionState: 'evaluated',
        feedback: { ...result }
      };
    } else if (result?.status === 'question_unavailable') {
      session.items[key] = {
        ...(session.items[key] ?? {}),
        submissionState: 'withdrawn',
        feedback: null
      };
    }
    if (Number.isInteger(Number(result?.next_position))) session.serverNextPosition = Number(result.next_position);
    return session;
  });
}

export async function setLocalBookmark(userId, sessionId, position, bookmarked) {
  return updateLocalSession(userId, sessionId, (session) => {
    const key = String(position);
    session.items ??= {};
    session.items[key] = { ...(session.items[key] ?? {}), bookmarked: Boolean(bookmarked) };
    return session;
  });
}

export async function queueAnswerOperation(userId, operation) {
  await ensureStudyUser(userId);
  await withTransaction(['answer_outbox'], 'readwrite', async ({ answer_outbox: store }) => {
    store.put({ ...operation, userId, queuedAt: operation.queuedAt ?? Date.now(), attempts: operation.attempts ?? 0 });
  });
}

export async function listAnswerOutbox(userId, sessionId = null) {
  await ensureStudyUser(userId);
  return withTransaction(['answer_outbox'], 'readonly', async ({ answer_outbox: store }) => {
    const all = await requestResult(store.getAll());
    return all
      .filter((item) => item.userId === userId && (!sessionId || item.sessionId === sessionId))
      .sort((a, b) => Number(a.queuedAt) - Number(b.queuedAt));
  });
}

export async function removeAnswerOperation(userId, operationId) {
  await ensureStudyUser(userId);
  return withTransaction(['answer_outbox'], 'readwrite', async ({ answer_outbox: store }) => {
    const current = await requestResult(store.get(operationId));
    if (current?.userId === userId) store.delete(operationId);
  });
}

export async function queueBookmarkOperation(userId, operation) {
  await ensureStudyUser(userId);
  return withTransaction(['bookmark_outbox'], 'readwrite', async ({ bookmark_outbox: store }) => {
    const all = await requestResult(store.getAll());
    for (const item of all) {
      if (item.userId === userId && item.sessionId === operation.sessionId && item.questionId === operation.questionId) {
        store.delete(item.operationId);
      }
    }
    store.put({ ...operation, userId, queuedAt: operation.queuedAt ?? Date.now(), attempts: operation.attempts ?? 0 });
  });
}

export async function listBookmarkOutbox(userId, sessionId = null) {
  await ensureStudyUser(userId);
  return withTransaction(['bookmark_outbox'], 'readonly', async ({ bookmark_outbox: store }) => {
    const all = await requestResult(store.getAll());
    return all
      .filter((item) => item.userId === userId && (!sessionId || item.sessionId === sessionId))
      .sort((a, b) => Number(a.sequence) - Number(b.sequence));
  });
}

export async function removeBookmarkOperation(userId, operationId) {
  await ensureStudyUser(userId);
  return withTransaction(['bookmark_outbox'], 'readwrite', async ({ bookmark_outbox: store }) => {
    const current = await requestResult(store.get(operationId));
    if (current?.userId === userId) store.delete(operationId);
  });
}

export async function nextBookmarkSequence(userId) {
  await ensureStudyUser(userId);
  return withTransaction(['app_meta'], 'readwrite', async ({ app_meta: store }) => {
    const current = await requestResult(store.get('bookmark_sequence'));
    const next = Math.max(Number(current?.value ?? 0) + 1, Date.now());
    store.put({ key: 'bookmark_sequence', value: next, updatedAt: new Date().toISOString() });
    return next;
  });
}

export async function setPendingStart(userId, pending) {
  await ensureStudyUser(userId);
  return setMeta('pending_start', pending);
}

export async function getPendingStart(userId) {
  await ensureStudyUser(userId);
  return (await getMeta('pending_start'))?.value ?? null;
}

export async function clearPendingStart(userId) {
  await ensureStudyUser(userId);
  return deleteMeta('pending_start');
}
