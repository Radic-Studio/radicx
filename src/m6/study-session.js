import { restoreValidatedSession } from '../m5/auth-service.js';
import { getOwnProfile } from '../m5/profile-service.js';
import { getSupabaseClient } from '../m5/supabase-client.js';
import { isOnboardingComplete } from '../m5/state.js';
import {
  cacheStudyPackage,
  ensureStudyUser,
  getCachedStudyPackage,
  getLocalSession,
  listAnswerOutbox,
  listBookmarkOutbox,
  markLocalAnswerPending,
  nextBookmarkSequence,
  queueAnswerOperation,
  queueBookmarkOperation,
  removeAnswerOperation,
  removeBookmarkOperation,
  setLocalBookmark,
  setLocalPosition,
  setLocalSelection
} from './study-db.js';
import {
  isNetworkStudyError,
  isStaleStudyError,
  newOperationId,
  studyActiveSession,
  studyCompleteSession,
  studyErrorMessage,
  studyReportQuestion,
  studyResumeSession
} from './study-service.js';
import { registerStudySyncTriggers, syncStudyOutboxes } from './study-sync.js';
import {
  canSubmitLocalItem,
  localCompletionState,
  nextNavigablePosition,
  previousNavigablePosition,
  studyModeLabel
} from './study-state.js';

let client;
let userId;
let sessionId;
let packageData = null;
let localSession = null;
let syncConflict = false;
let syncing = false;
let completionInFlight = false;

function byId(id) {
  return document.getElementById(id);
}

function optionLetter(index) {
  return String.fromCharCode(65 + Number(index));
}

function setSync(label, tone = 'success') {
  const node = byId('study-sync-state');
  node.className = `radic-sync-state radic-sync-state--${tone}`;
  node.innerHTML = '<span class="radic-status-dot" aria-hidden="true"></span>';
  node.append(document.createTextNode(label));
}

function showMessage(message, tone = 'neutral') {
  const node = byId('focus-message');
  node.hidden = false;
  node.dataset.tone = tone;
  node.textContent = message;
}

function clearMessage() {
  const node = byId('focus-message');
  node.hidden = true;
  node.textContent = '';
}

function currentQuestion() {
  return packageData?.questions?.find((question) => Number(question.position) === Number(localSession?.localPosition)) ?? null;
}

function currentItem() {
  return localSession?.items?.[String(localSession.localPosition)] ?? null;
}

function renderFeedback(question, item) {
  const feedback = byId('study-feedback');
  feedback.hidden = true;
  feedback.className = 'm6-feedback';
  feedback.replaceChildren();

  if (item?.submissionState === 'pending') {
    showMessage('Answer saved on this device. We’ll check it when you’re back online.', 'offline');
    return;
  }
  if (item?.submissionState === 'withdrawn') {
    showMessage('This question became unavailable after your session was prepared. It will be skipped without changing your answered history.', 'neutral');
    return;
  }
  if (item?.submissionState !== 'evaluated' || !item.feedback) return;

  clearMessage();
  const result = item.feedback;
  const correct = result.correct === true;
  feedback.hidden = false;
  feedback.classList.add(correct ? 'm6-feedback--correct' : 'm6-feedback--incorrect');

  const heading = document.createElement('h2');
  heading.textContent = correct ? 'Correct' : 'Not quite';
  feedback.append(heading);

  if (!correct && Number.isInteger(Number(result.correct_option))) {
    const correctIndex = Number(result.correct_option);
    const answer = Array.isArray(question.options) ? question.options[correctIndex] : null;
    const line = document.createElement('p');
    line.textContent = answer
      ? `The best answer is ${optionLetter(correctIndex)}. ${answer}`
      : `The best answer is option ${optionLetter(correctIndex)}.`;
    feedback.append(line);
  }

  if (result.explanation) {
    const explanation = document.createElement('p');
    explanation.textContent = result.explanation;
    feedback.append(explanation);
  } else {
    const unavailable = document.createElement('p');
    unavailable.textContent = 'No reviewed explanation is available for this question yet.';
    feedback.append(unavailable);
  }
}

function renderOptions(question, item) {
  const group = byId('answer-options');
  group.replaceChildren(group.querySelector('legend'));
  const locked = item?.submissionState !== 'draft';

  question.options.forEach((option, index) => {
    const label = document.createElement('label');
    label.className = 'm6-answer-option';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'study-answer';
    input.value = String(index);
    input.checked = Number(item?.selectedOption) === index;
    input.disabled = locked;
    input.addEventListener('change', async () => {
      localSession = await setLocalSelection(userId, sessionId, question.position, { selectedOption: index });
      render();
    });
    const key = document.createElement('span');
    key.className = 'm6-answer-option__key';
    key.textContent = optionLetter(index);
    const copy = document.createElement('span');
    copy.textContent = option;
    label.append(input, key, copy);
    group.append(label);
  });
}

function renderConfidence(item) {
  const locked = item?.submissionState !== 'draft';
  for (const input of document.querySelectorAll('input[name="confidence"]')) {
    input.checked = Number(item?.confidence) === Number(input.value);
    input.disabled = locked;
    input.onchange = async () => {
      localSession = await setLocalSelection(userId, sessionId, localSession.localPosition, {
        confidence: Number(input.value)
      });
      render();
    };
  }
}

function render() {
  if (!packageData || !localSession) return;
  const question = currentQuestion();
  const item = currentItem();
  if (!question || !item) {
    showMessage('This cached question is unavailable. Return to Study and resume the session.', 'error');
    return;
  }

  byId('study-summary').hidden = true;
  byId('study-actions').hidden = false;
  byId('study-mode-label').textContent = studyModeLabel(localSession.studyKind);
  byId('question-context').textContent = [question.subject_name, question.topic_name].filter(Boolean).join(' · ') || 'General Study';
  byId('focus-question-title').textContent = question.stem ?? 'This question is no longer available.';

  const target = Number(localSession.targetQuestionCount || packageData.questions.length || 1);
  const position = Number(question.position);
  const percent = Math.max(0, Math.min(100, Math.round(position * 100 / target)));
  byId('question-progress-label').textContent = `Question ${position} of ${target}`;
  byId('question-progress').setAttribute('aria-valuenow', String(percent));
  byId('question-progress-bar').style.width = `${percent}%`;

  renderOptions(question, item);
  renderConfidence(item);
  renderFeedback(question, item);

  const bookmark = byId('bookmark-question');
  bookmark.setAttribute('aria-pressed', String(Boolean(item.bookmarked)));
  bookmark.textContent = item.bookmarked ? 'Bookmarked' : 'Bookmark';

  const previous = previousNavigablePosition(packageData.questions, position);
  byId('previous-question').disabled = previous === null;

  const submit = byId('submit-answer');
  const next = byId('next-question');
  submit.hidden = item.submissionState !== 'draft';
  submit.disabled = !canSubmitLocalItem(item) || syncing || syncConflict;
  next.hidden = item.submissionState === 'draft';

  const nextPosition = nextNavigablePosition(packageData.questions, position, localSession.items);
  if (item.submissionState !== 'draft') {
    if (nextPosition !== null) {
      next.textContent = 'Next Question';
      next.disabled = false;
    } else {
      const completion = localCompletionState(packageData.questions, localSession);
      next.textContent = completion.pending > 0 ? 'Finish when synced' : 'Finish Study';
      next.disabled = completion.pending > 0 || syncing || syncConflict;
    }
  }

  byId('retry-sync').hidden = !(syncConflict || globalThis.navigator?.onLine === false);
  byId('report-question').disabled = globalThis.navigator?.onLine === false;

  if (syncConflict) {
    setSync('Sync required', 'warning');
    showMessage('This session changed on another device. Use Retry sync to reload the latest server state before sending more work.', 'error');
  } else if (globalThis.navigator?.onLine === false) {
    setSync('Offline · saved on this device', 'offline');
  }
}

async function reloadLocal() {
  localSession = await getLocalSession(userId, sessionId);
  render();
}

async function syncSession(reason = 'manual') {
  if (syncing || syncConflict) return;
  syncing = true;
  setSync('Syncing…', 'neutral');
  try {
    const result = await syncStudyOutboxes(client, userId, {
      sessionId,
      onStatus(status) {
        if (status === 'offline') setSync('Offline · saved on this device', 'offline');
        else if (status === 'failed') setSync('Sync failed · retry', 'warning');
        else if (status === 'saved') setSync('Saved', 'success');
      },
      onConflict() {
        syncConflict = true;
      },
      onFailure(error, operation, kind) {
        console.error(`M6 ${kind} sync failed`, operation?.operationId, error);
        showMessage(studyErrorMessage(error, kind), 'error');
      }
    });
    await reloadLocal();
    if (!result.blocked && reason !== 'launch') clearMessage();
  } finally {
    syncing = false;
    render();
  }
}

async function submitCurrentAnswer() {
  const question = currentQuestion();
  const item = currentItem();
  if (!question || !canSubmitLocalItem(item) || syncConflict) return;

  const operation = {
    operationId: newOperationId(),
    sessionId,
    questionId: question.question_id,
    position: Number(question.position),
    selectedOption: Number(item.selectedOption),
    confidence: Number(item.confidence),
    deviceVersion: Number(localSession.deviceVersion),
    queuedAt: Date.now()
  };

  try {
    await queueAnswerOperation(userId, operation);
    localSession = await markLocalAnswerPending(userId, sessionId, question.position, operation);
    setSync(globalThis.navigator?.onLine === false ? 'Offline · saved on this device' : 'Saving…', globalThis.navigator?.onLine === false ? 'offline' : 'neutral');
    render();
    if (globalThis.navigator?.onLine !== false) await syncSession('answer');
  } catch (error) {
    showMessage('RadicX could not save this answer on the device. Stay online and retry before leaving the page.', 'error');
    console.error('M6 local answer queue failed', error);
  }
}

async function toggleBookmark() {
  const question = currentQuestion();
  const item = currentItem();
  if (!question || !item || syncConflict) return;
  const desired = !Boolean(item.bookmarked);
  try {
    const sequence = await nextBookmarkSequence(userId);
    const operation = {
      operationId: newOperationId(),
      sessionId,
      questionId: question.question_id,
      position: Number(question.position),
      bookmarked: desired,
      sequence,
      deviceVersion: Number(localSession.deviceVersion),
      queuedAt: Date.now()
    };
    await queueBookmarkOperation(userId, operation);
    localSession = await setLocalBookmark(userId, sessionId, question.position, desired);
    render();
    if (globalThis.navigator?.onLine !== false) await syncSession('bookmark');
    else showMessage('Bookmark change saved on this device. It will sync when you’re back online.', 'offline');
  } catch (error) {
    showMessage('RadicX could not save this bookmark change on the device.', 'error');
    console.error('M6 bookmark queue failed', error);
  }
}

async function navigate(position) {
  if (position === null) return;
  localSession = await setLocalPosition(userId, sessionId, position);
  clearMessage();
  render();
  byId('focus-question-title').focus?.({ preventScroll: true });
}

async function nextOrFinish() {
  const nextPosition = nextNavigablePosition(packageData.questions, localSession.localPosition, localSession.items);
  if (nextPosition !== null) {
    await navigate(nextPosition);
    return;
  }
  await finishStudy();
}

function formatDuration(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(value / 60);
  const remaining = value % 60;
  if (minutes === 0) return `${remaining}s`;
  return `${minutes}m ${remaining}s`;
}

function renderSummary(summary) {
  byId('study-actions').hidden = true;
  byId('study-summary').hidden = false;
  byId('summary-answered').textContent = String(summary.questions_answered ?? 0);
  byId('summary-correct').textContent = String(summary.correct ?? 0);
  byId('summary-incorrect').textContent = String(summary.incorrect ?? 0);
  byId('summary-completion').textContent = `${summary.completion_percentage ?? 0}%`;
  byId('summary-duration').textContent = formatDuration(summary.duration_seconds);
  byId('study-summary-title').focus?.({ preventScroll: true });
}

async function finishStudy() {
  if (completionInFlight || syncConflict) return;
  completionInFlight = true;
  try {
    await syncSession('completion');
    const pending = await listAnswerOutbox(userId, sessionId);
    if (pending.length > 0) {
      showMessage('Your remaining answers are saved on this device. Reconnect and sync them before finishing the session.', 'offline');
      return;
    }
    const completion = localCompletionState(packageData.questions, localSession);
    if (!completion.readyForServerCompletion) {
      showMessage('Finish the remaining Study questions before completing this session.', 'neutral');
      return;
    }
    setSync('Saving…', 'neutral');
    const summary = await studyCompleteSession(client, sessionId, localSession.deviceVersion);
    setSync('Saved', 'success');
    renderSummary(summary);
  } catch (error) {
    showMessage(studyErrorMessage(error), isNetworkStudyError(error) ? 'offline' : 'error');
  } finally {
    completionInFlight = false;
  }
}

async function reconcileAfterConflict() {
  if (globalThis.navigator?.onLine === false) {
    showMessage('Reconnect before reloading the latest Study session.', 'offline');
    return;
  }
  setSync('Syncing…', 'neutral');
  try {
    const latest = await studyResumeSession(client, sessionId, null);
    const newVersion = Number(latest.session.device_version);
    const serverByQuestion = new Map(latest.questions.map((question) => [question.question_id, question]));

    for (const operation of await listAnswerOutbox(userId, sessionId)) {
      const serverQuestion = serverByQuestion.get(operation.questionId);
      await removeAnswerOperation(userId, operation.operationId);
      if (!serverQuestion || serverQuestion.answer || serverQuestion.state === 'withdrawn' || serverQuestion.available === false) continue;
      await queueAnswerOperation(userId, { ...operation, deviceVersion: newVersion });
    }
    for (const operation of await listBookmarkOutbox(userId, sessionId)) {
      await removeBookmarkOperation(userId, operation.operationId);
      if (!serverByQuestion.has(operation.questionId)) continue;
      await queueBookmarkOperation(userId, { ...operation, deviceVersion: newVersion });
    }

    const cached = await cacheStudyPackage(userId, latest);
    packageData = cached.package;
    localSession = cached.localSession;
    syncConflict = false;
    await syncSession('conflict-recovery');
    setSync('Saved', 'success');
  } catch (error) {
    syncConflict = isStaleStudyError(error) || syncConflict;
    showMessage(studyErrorMessage(error), 'error');
  }
  render();
}

function bindReportDialog() {
  const dialog = byId('report-dialog');
  byId('report-question').addEventListener('click', () => {
    if (globalThis.navigator?.onLine === false) {
      showMessage('Connect to the internet to send a question report.', 'offline');
      return;
    }
    dialog.showModal();
  });
  const close = () => dialog.close();
  byId('close-report').addEventListener('click', close);
  byId('cancel-report').addEventListener('click', close);
  byId('report-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const question = currentQuestion();
    if (!question) return;
    const send = byId('send-report');
    send.disabled = true;
    try {
      await studyReportQuestion(client, {
        sessionId,
        questionId: question.question_id,
        category: byId('report-category').value,
        details: byId('report-details').value || null
      });
      close();
      byId('report-details').value = '';
      showMessage('Report sent. Thank you for flagging the question.', 'success');
    } catch (error) {
      showMessage(studyErrorMessage(error, 'report'), 'error');
      close();
    } finally {
      send.disabled = false;
    }
  });
}

function bindActions() {
  byId('submit-answer').addEventListener('click', () => void submitCurrentAnswer());
  byId('bookmark-question').addEventListener('click', () => void toggleBookmark());
  byId('previous-question').addEventListener('click', () => void navigate(previousNavigablePosition(packageData.questions, localSession.localPosition)));
  byId('next-question').addEventListener('click', () => void nextOrFinish());
  byId('retry-sync').addEventListener('click', () => void (syncConflict ? reconcileAfterConflict() : syncSession('retry')));
  bindReportDialog();
}

async function resolveSessionId() {
  const requested = new URL(window.location.href).searchParams.get('session');
  if (requested) return requested;
  if (globalThis.navigator?.onLine === false) return null;
  const active = await studyActiveSession(client);
  return active?.session_id ?? null;
}

async function loadStudySession() {
  sessionId = await resolveSessionId();
  if (!sessionId) {
    showMessage('No Study session is available on this device. Return to Study to start or resume one.', 'neutral');
    return false;
  }

  let cached = null;
  try {
    cached = await getCachedStudyPackage(userId, sessionId);
  } catch (error) {
    console.error('M6 cached Study load failed', error);
  }

  if (cached?.questions?.length) {
    packageData = { session: cached.session, questions: cached.questions };
    localSession = cached.localSession;
    render();
  }

  if (globalThis.navigator?.onLine === false) {
    if (!cached?.questions?.length) {
      showMessage('This Study session is not cached on this device. Reconnect to load it.', 'offline');
      return false;
    }
    setSync('Offline · saved on this device', 'offline');
    return true;
  }

  try {
    const serverPackage = await studyResumeSession(client, sessionId, cached?.localSession?.deviceVersion ?? null);
    const saved = await cacheStudyPackage(userId, serverPackage);
    packageData = saved.package;
    localSession = saved.localSession;
    await syncSession('launch');
    render();
    return true;
  } catch (error) {
    if (isStaleStudyError(error) && cached?.questions?.length) {
      syncConflict = true;
      render();
      return true;
    }
    if (cached?.questions?.length && isNetworkStudyError(error)) {
      setSync('Offline · saved on this device', 'offline');
      showMessage('The network dropped while resuming. Your cached Study session is still available.', 'offline');
      return true;
    }
    showMessage(studyErrorMessage(error), 'error');
    return false;
  }
}

async function main() {
  document.body.dataset.authState = 'loading';
  try {
    client = await getSupabaseClient();
  } catch {
    document.body.dataset.authState = 'anonymous';
    window.location.replace('/login.html?next=/focus.html');
    return;
  }

  const auth = await restoreValidatedSession(client);
  if (auth.status !== 'authenticated') {
    document.body.dataset.authState = 'anonymous';
    window.location.replace('/login.html?next=/focus.html');
    return;
  }
  userId = auth.user.id;
  const profile = await getOwnProfile(client, userId);
  if (!isOnboardingComplete(profile)) {
    window.location.replace('/onboarding.html');
    return;
  }

  try {
    await ensureStudyUser(userId);
  } catch (error) {
    console.error('M6 IndexedDB unavailable', error);
    showMessage('Local Study saving is unavailable in this browser. Stay online and keep this page open.', 'error');
  }

  bindActions();
  document.body.dataset.authState = 'authenticated';
  const loaded = await loadStudySession();
  if (!loaded) return;

  registerStudySyncTriggers(async () => {
    if (!syncConflict) await syncSession('lifecycle');
    else render();
  });

  globalThis.addEventListener('offline', () => {
    setSync('Offline · saved on this device', 'offline');
    render();
  });
  globalThis.addEventListener('online', () => {
    if (!syncConflict) void syncSession('online');
    else render();
  });
}

main().catch((error) => {
  console.error('M6 Study session initialization failed', error);
  showMessage(studyErrorMessage(error), 'error');
  document.body.dataset.authState = 'authenticated';
});
