import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const chromeCandidates = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
let chrome = null;
for (const candidate of chromeCandidates) {
  try {
    execFileSync(candidate, ['--version'], { stdio: 'ignore' });
    chrome = candidate;
    break;
  } catch {
    // Continue through known CI browser names.
  }
}
if (!chrome) throw new Error('M6 browser storage smoke requires Chromium/Chrome on the CI runner.');

const distRoot = path.resolve('dist');
const fixture = path.join(distRoot, 'm6-storage-smoke.html');
const profileDir = path.resolve('.m6-chrome-profile');
await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });

const html = `<!doctype html>
<html lang="en" data-m6-storage="running">
<head><meta charset="utf-8"><title>M6 storage smoke</title></head>
<body>
<script>
  window.__m6ReportSent = false;
  window.__m6Report = async function(payload) {
    if (window.__m6ReportSent) return;
    window.__m6ReportSent = true;
    document.documentElement.dataset.m6Storage = payload.status;
    if (payload.status !== 'pass') document.body.textContent = JSON.stringify(payload);
    try {
      await fetch('/__m6_result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch {
      // The Node-side timeout remains the final failure signal if the callback cannot be delivered.
    }
  };
  window.addEventListener('error', function(event) {
    void window.__m6Report({ status: 'error', error: event.message || 'browser script error' });
  });
  window.addEventListener('unhandledrejection', function(event) {
    void window.__m6Report({ status: 'error', error: String(event.reason?.stack || event.reason || 'unhandled rejection') });
  });
</script>
<script type="module">
try {
  const dbModule = await import('./assets/m6/study-db.js');
  const { syncStudyOutboxes } = await import('./assets/m6/study-sync.js');
  const {
    STUDY_DB_STORES,
    cacheStudyPackage,
    ensureStudyUser,
    getCachedStudyPackage,
    listAnswerOutbox,
    listBookmarkOutbox,
    markLocalAnswerPending,
    openStudyDb,
    queueAnswerOperation,
    queueBookmarkOperation,
    setLocalBookmark,
    setLocalPosition,
    setLocalSelection
  } = dbModule;

  const userId = 'browser-smoke-user';
  const sessionId = 'browser-smoke-session';
  const answerOperation = {
    operationId: 'answer-op-1',
    sessionId,
    questionId: 'browser-question-1',
    position: 1,
    selectedOption: 2,
    confidence: 3,
    deviceVersion: 1,
    queuedAt: 1
  };
  const bookmarkOperation = {
    operationId: 'bookmark-op-1',
    sessionId,
    questionId: 'browser-question-1',
    position: 1,
    bookmarked: true,
    sequence: 1,
    deviceVersion: 1,
    queuedAt: 2
  };
  const phase = sessionStorage.getItem('m6-storage-phase') || 'queue';

  if (phase === 'queue') {
    await ensureStudyUser(userId);
    await cacheStudyPackage(userId, {
      session: {
        id: sessionId,
        study_kind: 'quick',
        target_question_count: 2,
        current_position: 1,
        device_version: 1,
        status: 'active'
      },
      questions: [
        {
          position: 1,
          question_id: 'browser-question-1',
          revision_id: 'browser-question-1',
          revision_number: 2,
          state: 'assigned',
          available: true,
          stem: 'Browser-safe cached question one',
          options: ['A','B','C','D'],
          subject_id: 'subject-1',
          subject_name: 'Subject',
          topic_id: null,
          topic_name: null,
          bookmarked: false
        },
        {
          position: 2,
          question_id: 'browser-question-2',
          revision_id: 'browser-question-2',
          revision_number: 1,
          state: 'assigned',
          available: true,
          stem: 'Browser-safe cached question two',
          options: ['A','B','C','D'],
          subject_id: 'subject-1',
          subject_name: 'Subject',
          topic_id: null,
          topic_name: null,
          bookmarked: false
        }
      ]
    });

    await setLocalSelection(userId, sessionId, 1, { selectedOption: 2, confidence: 3 });
    await markLocalAnswerPending(userId, sessionId, 1, answerOperation);
    await queueAnswerOperation(userId, answerOperation);
    await setLocalBookmark(userId, sessionId, 1, true);
    await queueBookmarkOperation(userId, bookmarkOperation);

    const navigationStarted = performance.now();
    await setLocalPosition(userId, sessionId, 2);
    const afterNavigation = await getCachedStudyPackage(userId, sessionId);
    const cachedNavigationMs = performance.now() - navigationStarted;
    const answers = await listAnswerOutbox(userId, sessionId);
    const bookmarks = await listBookmarkOutbox(userId, sessionId);
    const db = await openStudyDb();
    const actualStores = Array.from(db.objectStoreNames).sort();
    db.close();
    const expectedStores = [...STUDY_DB_STORES].sort();
    const storesMatch = actualStores.length === expectedStores.length
      && expectedStores.every((name, index) => actualStores[index] === name);
    const questionCacheText = JSON.stringify(afterNavigation?.questions ?? []);
    const safeQuestionCache = !questionCacheText.includes('correct_option')
      && !questionCacheText.includes('explanation_private')
      && !questionCacheText.includes('private.question_keys');
    const queuedCorrectly = afterNavigation?.localSession?.localPosition === 2
      && afterNavigation?.localSession?.items?.['1']?.selectedOption === 2
      && afterNavigation?.localSession?.items?.['1']?.confidence === 3
      && afterNavigation?.localSession?.items?.['1']?.submissionState === 'pending'
      && afterNavigation?.localSession?.items?.['1']?.feedback == null
      && answers.length === 1
      && bookmarks.length === 1
      && storesMatch
      && safeQuestionCache;

    if (!queuedCorrectly) {
      await window.__m6Report({
        status: 'fail',
        stage: 'queue',
        actualStores,
        expectedStores,
        cachedNavigationMs,
        answerOutboxCount: answers.length,
        bookmarkOutboxCount: bookmarks.length,
        safeQuestionCache,
        localSession: afterNavigation?.localSession ?? null
      });
    } else {
      sessionStorage.setItem('m6-storage-phase', 'resume');
      location.reload();
    }
  } else {
    const resumed = await getCachedStudyPackage(userId, sessionId);
    const answersBefore = await listAnswerOutbox(userId, sessionId);
    const bookmarksBefore = await listBookmarkOutbox(userId, sessionId);
    const beforeText = JSON.stringify(resumed?.questions ?? []);
    const safeQuestionCacheAfterRefresh = !beforeText.includes('correct_option')
      && !beforeText.includes('explanation_private')
      && !beforeText.includes('private.question_keys');
    const pendingSurvivedRefresh = resumed?.localSession?.localPosition === 2
      && resumed?.localSession?.items?.['1']?.submissionState === 'pending'
      && resumed?.localSession?.items?.['1']?.selectedOption === 2
      && resumed?.localSession?.items?.['1']?.confidence === 3
      && resumed?.localSession?.items?.['1']?.feedback == null
      && answersBefore.length === 1
      && bookmarksBefore.length === 1;

    let online = false;
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get() { return online; }
    });

    const rpcCalls = [];
    const fakeClient = {
      async rpc(name, params) {
        rpcCalls.push({ name, params });
        if (name === 'study_submit_answer') {
          return {
            data: {
              status: 'evaluated',
              session_id: params.p_session_id,
              question_id: params.p_question_id,
              selected_option: params.p_selected_option,
              confidence: params.p_confidence,
              correct: false,
              correct_option: 1,
              explanation: 'Synthetic authoritative browser-smoke feedback.',
              evaluated_at: '2026-09-04T21:00:00Z',
              next_position: 2,
              complete_ready: false
            },
            error: null
          };
        }
        if (name === 'study_set_bookmark') {
          return {
            data: {
              question_id: params.p_question_id,
              bookmarked: params.p_is_bookmarked,
              applied: true
            },
            error: null
          };
        }
        return { data: null, error: { message: 'Unexpected browser-smoke RPC' } };
      }
    };

    const offlineStatuses = [];
    const offlineSync = await syncStudyOutboxes(fakeClient, userId, {
      sessionId,
      onStatus: (status) => offlineStatuses.push(status)
    });
    const stillPending = await getCachedStudyPackage(userId, sessionId);
    const noOfflineCorrectness = offlineSync.blocked === 'offline'
      && rpcCalls.length === 0
      && stillPending?.localSession?.items?.['1']?.submissionState === 'pending'
      && stillPending?.localSession?.items?.['1']?.feedback == null;

    online = true;
    const onlineStatuses = [];
    const syncedAnswers = [];
    const onlineSync = await syncStudyOutboxes(fakeClient, userId, {
      sessionId,
      onStatus: (status) => onlineStatuses.push(status),
      onAnswer: (operation, result) => syncedAnswers.push({ operation, result })
    });
    const reconciled = await getCachedStudyPackage(userId, sessionId);
    const answersAfter = await listAnswerOutbox(userId, sessionId);
    const bookmarksAfter = await listBookmarkOutbox(userId, sessionId);
    const replay = await syncStudyOutboxes(fakeClient, userId, { sessionId });

    sessionStorage.removeItem('m6-storage-phase');
    const browserStorageText = JSON.stringify({
      localStorage: { ...localStorage },
      sessionStorage: { ...sessionStorage }
    });
    const noPrivateBrowserStorage = !browserStorageText.includes('explanation_private')
      && !browserStorageText.includes('private.question_keys');

    const pass = pendingSurvivedRefresh
      && safeQuestionCacheAfterRefresh
      && noOfflineCorrectness
      && offlineStatuses.includes('offline')
      && onlineSync.answersSynced === 1
      && onlineSync.bookmarksSynced === 1
      && onlineSync.blocked == null
      && onlineStatuses.at(-1) === 'saved'
      && syncedAnswers.length === 1
      && reconciled?.localSession?.items?.['1']?.submissionState === 'evaluated'
      && reconciled?.localSession?.items?.['1']?.feedback?.correct === false
      && reconciled?.localSession?.items?.['1']?.feedback?.correct_option === 1
      && reconciled?.localSession?.items?.['1']?.bookmarked === true
      && answersAfter.length === 0
      && bookmarksAfter.length === 0
      && replay.answersSynced === 0
      && replay.bookmarksSynced === 0
      && rpcCalls.length === 2
      && noPrivateBrowserStorage;

    await window.__m6Report({
      status: pass ? 'pass' : 'fail',
      stage: 'resume-reconcile',
      pendingSurvivedRefresh,
      safeQuestionCacheAfterRefresh,
      noOfflineCorrectness,
      offlineBlocked: offlineSync.blocked,
      onlineSync,
      answerOutboxAfter: answersAfter.length,
      bookmarkOutboxAfter: bookmarksAfter.length,
      replay,
      rpcCallNames: rpcCalls.map((call) => call.name),
      feedbackStatus: reconciled?.localSession?.items?.['1']?.submissionState ?? null,
      noPrivateBrowserStorage
    });
  }
} catch (error) {
  await window.__m6Report({ status: 'error', error: String(error?.stack ?? error) });
}
</script>
</body></html>`;

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) reject(new Error('M6 browser smoke callback exceeded the size limit.'));
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function stopBrowser(child) {
  if (!child || child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    child.once('exit', finish);
    child.kill('SIGTERM');
    const forceTimer = setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
      setTimeout(finish, 250).unref();
    }, 2000);
    forceTimer.unref();
  });
}

let resolveBrowserResult;
let rejectBrowserResult;
const browserResult = new Promise((resolve, reject) => {
  resolveBrowserResult = resolve;
  rejectBrowserResult = reject;
});

await writeFile(fixture, html, 'utf8');
let server;
let browser;
try {
  server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (requestUrl.pathname === '/__m6_result' && request.method === 'POST') {
        const body = await readRequestBody(request);
        const result = JSON.parse(body);
        response.writeHead(204, { 'Cache-Control': 'no-store' });
        response.end();
        resolveBrowserResult(result);
        return;
      }

      const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '') || 'm6-storage-smoke.html';
      const filePath = path.resolve(distRoot, relativePath);
      if (filePath !== distRoot && !filePath.startsWith(`${distRoot}${path.sep}`)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const body = await readFile(filePath);
      response.writeHead(200, {
        'Content-Type': contentType(filePath),
        'Cache-Control': 'no-store'
      });
      response.end(body);
    } catch (error) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      if (request.url === '/__m6_result') rejectBrowserResult(error);
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('M6 browser storage smoke could not determine its loopback port.');

  browser = spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--remote-debugging-port=0',
    `--user-data-dir=${profileDir}`,
    `http://127.0.0.1:${address.port}/m6-storage-smoke.html`
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  let browserStderr = '';
  browser.stderr.setEncoding('utf8');
  browser.stderr.on('data', (chunk) => { browserStderr += chunk; });
  browser.once('error', rejectBrowserResult);
  browser.once('exit', (code, signal) => {
    if (code !== null && code !== 0) {
      rejectBrowserResult(new Error(`Chromium exited before reporting the M6 storage result (${code ?? signal}).\n${browserStderr}`));
    }
  });

  const timeout = new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error(`M6 browser storage smoke timed out waiting for the real-browser callback.\n${browserStderr}`)), 25000);
    timer.unref();
  });
  const result = await Promise.race([browserResult, timeout]);

  if (result?.status !== 'pass') {
    throw new Error(`M6 IndexedDB/offline/outbox browser smoke failed: ${JSON.stringify(result)}`);
  }
  console.log('M6 real-browser IndexedDB, offline refresh, outbox replay and authoritative reconciliation smoke passed on a loopback HTTP origin.');
} finally {
  await stopBrowser(browser);
  if (server) await new Promise((resolve) => server.close(resolve));
  await rm(fixture, { force: true });
  await rm(profileDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
