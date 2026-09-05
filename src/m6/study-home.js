import { restoreValidatedSession } from '../m5/auth-service.js';
import { getOwnProfile } from '../m5/profile-service.js';
import { getSupabaseClient } from '../m5/supabase-client.js';
import { isOnboardingComplete } from '../m5/state.js';
import {
  cacheStudyPackage,
  clearPendingStart,
  ensureStudyUser,
  getCachedStudyPackage,
  getPendingStart,
  setPendingStart
} from './study-db.js';
import {
  isNetworkStudyError,
  listStudySubjects,
  listStudyTopics,
  newOperationId,
  studyActiveSession,
  studyErrorMessage,
  studyResumeSession,
  studyStartSession
} from './study-service.js';
import { studyModeLabel } from './study-state.js';

let client;
let userId;
let profile;
let activeSession = null;
let startLocked = false;

function byId(id) {
  return document.getElementById(id);
}

function showMessage(message, tone = 'neutral') {
  const node = byId('study-home-message');
  node.hidden = false;
  node.dataset.tone = tone;
  node.textContent = message;
}

function clearMessage() {
  const node = byId('study-home-message');
  node.hidden = true;
  node.textContent = '';
}

function setSync(label, tone = 'success') {
  const node = byId('study-home-sync');
  node.className = `radic-sync-state radic-sync-state--${tone}`;
  node.innerHTML = '<span class="radic-status-dot" aria-hidden="true"></span>';
  node.append(document.createTextNode(label));
}

function fillSubjectSelect(select, subjects) {
  select.innerHTML = '<option value="">Choose a subject</option>';
  for (const subject of subjects) {
    const option = document.createElement('option');
    option.value = subject.id;
    option.textContent = subject.name;
    select.append(option);
  }
}

async function loadTopics(subjectId) {
  const topicSelect = byId('topic-select');
  const startTopic = byId('start-topic');
  topicSelect.innerHTML = '<option value="">Choose a topic</option>';
  topicSelect.disabled = true;
  startTopic.disabled = true;
  if (!subjectId) return;

  try {
    const topics = await listStudyTopics(client, subjectId);
    for (const topic of topics) {
      const option = document.createElement('option');
      option.value = topic.id;
      option.textContent = topic.name;
      topicSelect.append(option);
    }
    topicSelect.disabled = topics.length === 0;
    if (topics.length === 0) showMessage('No active topics are available in this subject yet.', 'neutral');
  } catch (error) {
    showMessage(studyErrorMessage(error), 'error');
  }
}

async function routeToPackage(packageData) {
  const sessionId = packageData?.session?.id;
  if (!sessionId) throw new Error('Study session did not return a session ID.');
  await cacheStudyPackage(userId, packageData);
  window.location.assign(`/focus.html?session=${encodeURIComponent(sessionId)}`);
}

async function startStudy({ kind, subjectId = null, topicId = null, questionCount = null, operationId = null }) {
  if (startLocked) return;
  if (globalThis.navigator?.onLine === false) {
    showMessage('Connect to the internet to start a new Study session. An already-cached session can continue offline.', 'offline');
    setSync('Offline · cached Study only', 'offline');
    return;
  }

  startLocked = true;
  clearMessage();
  const pending = {
    kind,
    subjectId,
    topicId,
    questionCount,
    operationId: operationId ?? newOperationId()
  };

  try {
    await setPendingStart(userId, pending);
    showMessage(`Preparing ${studyModeLabel(kind)}…`, 'neutral');
    const packageData = await studyStartSession(client, pending);
    await clearPendingStart(userId);
    await routeToPackage(packageData);
  } catch (error) {
    if (!isNetworkStudyError(error)) await clearPendingStart(userId);
    showMessage(studyErrorMessage(error, 'start'), isNetworkStudyError(error) ? 'offline' : 'error');
  } finally {
    startLocked = false;
  }
}

async function resumeStudy() {
  if (!activeSession) return;
  clearMessage();
  try {
    const cached = await getCachedStudyPackage(userId, activeSession.session_id);
    if (globalThis.navigator?.onLine === false) {
      if (cached?.questions?.length) {
        await routeToPackage(cached);
        return;
      }
      showMessage('This Study session is not cached on this device. Reconnect to resume it.', 'offline');
      return;
    }

    const localVersion = cached?.localSession?.deviceVersion;
    if (localVersion && Number(localVersion) !== Number(activeSession.device_version)) {
      const confirmed = globalThis.confirm(
        'This Study session changed on another device. Load the latest server state on this device? Accepted answers will be preserved.'
      );
      if (!confirmed) return;
      const packageData = await studyResumeSession(client, activeSession.session_id, null);
      await routeToPackage(packageData);
      return;
    }

    const packageData = await studyResumeSession(
      client,
      activeSession.session_id,
      localVersion ?? null
    );
    await routeToPackage(packageData);
  } catch (error) {
    showMessage(studyErrorMessage(error), 'error');
  }
}

function bindActions() {
  for (const button of document.querySelectorAll('[data-start-kind]')) {
    button.addEventListener('click', () => void startStudy({ kind: button.dataset.startKind }));
  }

  for (const button of document.querySelectorAll('[data-quick-count]')) {
    button.addEventListener('click', () => void startStudy({
      kind: 'quick',
      questionCount: Number(button.dataset.quickCount)
    }));
  }

  byId('subject-select').addEventListener('change', (event) => {
    byId('start-subject').disabled = !event.target.value;
  });
  byId('start-subject').addEventListener('click', () => void startStudy({
    kind: 'subject',
    subjectId: byId('subject-select').value,
    questionCount: 20
  }));

  byId('topic-subject-select').addEventListener('change', (event) => void loadTopics(event.target.value));
  byId('topic-select').addEventListener('change', (event) => {
    byId('start-topic').disabled = !event.target.value;
  });
  byId('start-topic').addEventListener('click', () => void startStudy({
    kind: 'topic',
    subjectId: byId('topic-subject-select').value,
    topicId: byId('topic-select').value,
    questionCount: 20
  }));

  byId('continue-study').addEventListener('click', () => void resumeStudy());
  globalThis.addEventListener('online', () => setSync('Online', 'success'));
  globalThis.addEventListener('offline', () => setSync('Offline · cached Study only', 'offline'));
}

async function main() {
  document.body.dataset.authState = 'loading';
  try {
    client = await getSupabaseClient();
  } catch {
    document.body.dataset.authState = 'anonymous';
    window.location.replace('/login.html?next=/study.html');
    return;
  }

  const auth = await restoreValidatedSession(client);
  if (auth.status !== 'authenticated') {
    document.body.dataset.authState = 'anonymous';
    window.location.replace('/login.html?next=/study.html');
    return;
  }

  userId = auth.user.id;
  profile = await getOwnProfile(client, userId);
  if (!isOnboardingComplete(profile)) {
    window.location.replace('/onboarding.html');
    return;
  }

  try {
    await ensureStudyUser(userId);
  } catch (error) {
    showMessage('Local Study saving is unavailable in this browser. Stay online and keep this tab open while studying.', 'error');
    console.error('M6 IndexedDB initialization failed', error);
  }

  const subjects = await listStudySubjects(client, profile.programme_id);
  fillSubjectSelect(byId('subject-select'), subjects);
  fillSubjectSelect(byId('topic-subject-select'), subjects);

  activeSession = await studyActiveSession(client);
  if (activeSession) {
    byId('continue-panel').hidden = false;
    byId('continue-copy').textContent = `${studyModeLabel(activeSession.study_kind)} · question ${activeSession.current_position ?? 1} of ${activeSession.target_question_count ?? 'your batch'}`;
  }

  const pending = await getPendingStart(userId).catch(() => null);
  if (pending && !activeSession && globalThis.navigator?.onLine !== false) {
    showMessage('Finishing the Study session you started before the connection was interrupted…');
    await startStudy(pending);
    return;
  }

  setSync(globalThis.navigator?.onLine === false ? 'Offline · cached Study only' : 'Online', globalThis.navigator?.onLine === false ? 'offline' : 'success');
  bindActions();
  document.body.dataset.authState = 'authenticated';
}

main().catch((error) => {
  console.error('M6 Study Home initialization failed', error);
  showMessage(studyErrorMessage(error), 'error');
  document.body.dataset.authState = 'authenticated';
});
