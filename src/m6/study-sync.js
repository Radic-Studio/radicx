import {
  applyServerAnswerResult,
  listAnswerOutbox,
  listBookmarkOutbox,
  removeAnswerOperation,
  removeBookmarkOperation,
  setLocalBookmark
} from './study-db.js';
import {
  isNetworkStudyError,
  isStaleStudyError,
  studySetBookmark,
  studySubmitAnswer
} from './study-service.js';

export function orderStudyOperations(operations = [], field = 'queuedAt') {
  return [...operations].sort((a, b) => Number(a[field] ?? 0) - Number(b[field] ?? 0));
}

export function classifyStudySyncError(error) {
  if (isStaleStudyError(error)) return 'stale';
  if (isNetworkStudyError(error)) return 'network';
  return 'server';
}

export async function syncStudyOutboxes(client, userId, {
  sessionId = null,
  onStatus = () => {},
  onAnswer = () => {},
  onConflict = () => {},
  onFailure = () => {}
} = {}) {
  if (globalThis.navigator && globalThis.navigator.onLine === false) {
    onStatus('offline');
    return { answersSynced: 0, bookmarksSynced: 0, blocked: 'offline' };
  }

  let answersSynced = 0;
  let bookmarksSynced = 0;
  onStatus('syncing');

  const answers = orderStudyOperations(await listAnswerOutbox(userId, sessionId));
  for (const operation of answers) {
    try {
      const result = await studySubmitAnswer(client, operation);
      await applyServerAnswerResult(userId, operation, result);
      await removeAnswerOperation(userId, operation.operationId);
      answersSynced += 1;
      onAnswer(operation, result);
    } catch (error) {
      const kind = classifyStudySyncError(error);
      if (kind === 'stale') {
        onConflict(error, operation);
        onStatus('conflict');
        return { answersSynced, bookmarksSynced, blocked: 'stale' };
      }
      if (kind === 'network') {
        onStatus('offline');
        return { answersSynced, bookmarksSynced, blocked: 'network' };
      }
      onFailure(error, operation, 'answer');
      onStatus('failed');
      return { answersSynced, bookmarksSynced, blocked: 'server' };
    }
  }

  const bookmarks = orderStudyOperations(await listBookmarkOutbox(userId, sessionId), 'sequence');
  for (const operation of bookmarks) {
    try {
      const result = await studySetBookmark(client, operation);
      await setLocalBookmark(userId, operation.sessionId, operation.position, Boolean(result?.bookmarked));
      await removeBookmarkOperation(userId, operation.operationId);
      bookmarksSynced += 1;
    } catch (error) {
      const kind = classifyStudySyncError(error);
      if (kind === 'stale') {
        onConflict(error, operation);
        onStatus('conflict');
        return { answersSynced, bookmarksSynced, blocked: 'stale' };
      }
      if (kind === 'network') {
        onStatus('offline');
        return { answersSynced, bookmarksSynced, blocked: 'network' };
      }
      onFailure(error, operation, 'bookmark');
      onStatus('failed');
      return { answersSynced, bookmarksSynced, blocked: 'server' };
    }
  }

  onStatus('saved');
  return { answersSynced, bookmarksSynced, blocked: null };
}

export function registerStudySyncTriggers(sync) {
  const online = () => void sync('online');
  const visibility = () => {
    if (document.visibilityState === 'visible') void sync('visible');
  };
  globalThis.addEventListener?.('online', online);
  document.addEventListener?.('visibilitychange', visibility);
  return () => {
    globalThis.removeEventListener?.('online', online);
    document.removeEventListener?.('visibilitychange', visibility);
  };
}
