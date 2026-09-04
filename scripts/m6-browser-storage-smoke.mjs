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
  const {
    STUDY_DB_STORES,
    cacheStudyPackage,
    ensureStudyUser,
    getCachedStudyPackage,
    listAnswerOutbox,
    listBookmarkOutbox,
    openStudyDb,
    queueAnswerOperation,
    queueBookmarkOperation,
    setLocalSelection
  } = await import('./assets/m6/study-db.js');

  const userId = 'browser-smoke-user';
  const sessionId = 'browser-smoke-session';
  await ensureStudyUser(userId);
  await cacheStudyPackage(userId, {
    session: {
      id: sessionId,
      study_kind: 'quick',
      target_question_count: 5,
      current_position: 1,
      device_version: 1,
      status: 'active'
    },
    questions: [{
      position: 1,
      question_id: 'browser-question-1',
      revision_id: 'browser-question-1',
      revision_number: 2,
      state: 'assigned',
      available: true,
      stem: 'Browser-safe cached question',
      options: ['A','B','C','D'],
      subject_id: 'subject-1',
      subject_name: 'Subject',
      topic_id: null,
      topic_name: null,
      bookmarked: false
    }]
  });
  await setLocalSelection(userId, sessionId, 1, { selectedOption: 2, confidence: 3 });
  await queueAnswerOperation(userId, {
    operationId: 'answer-op-1',
    sessionId,
    questionId: 'browser-question-1',
    position: 1,
    selectedOption: 2,
    confidence: 3,
    deviceVersion: 1,
    queuedAt: 1
  });
  await queueBookmarkOperation(userId, {
    operationId: 'bookmark-op-1',
    sessionId,
    questionId: 'browser-question-1',
    position: 1,
    bookmarked: true,
    sequence: 1,
    deviceVersion: 1,
    queuedAt: 1
  });

  const cached = await getCachedStudyPackage(userId, sessionId);
  const answers = await listAnswerOutbox(userId, sessionId);
  const bookmarks = await listBookmarkOutbox(userId, sessionId);
  const db = await openStudyDb();
  const actualStores = Array.from(db.objectStoreNames).sort();
  db.close();
  const expectedStores = [...STUDY_DB_STORES].sort();
  const storesMatch = actualStores.length === expectedStores.length
    && expectedStores.every((name, index) => actualStores[index] === name);
  const serializedWorkingState = JSON.stringify({ cached, answers, bookmarks });
  const noAnswerKey = !serializedWorkingState.includes('correct_option')
    && !serializedWorkingState.includes('explanation_private')
    && !serializedWorkingState.includes('private.question_keys');
  const pass = cached?.questions?.length === 1
    && cached?.localSession?.items?.['1']?.selectedOption === 2
    && cached?.localSession?.items?.['1']?.confidence === 3
    && answers.length === 1
    && answers[0]?.selectedOption === 2
    && answers[0]?.confidence === 3
    && bookmarks.length === 1
    && bookmarks[0]?.bookmarked === true
    && storesMatch
    && noAnswerKey;

  await window.__m6Report({
    status: pass ? 'pass' : 'fail',
    actualStores,
    expectedStores,
    selectedOption: cached?.localSession?.items?.['1']?.selectedOption ?? null,
    confidence: cached?.localSession?.items?.['1']?.confidence ?? null,
    answerOutboxCount: answers.length,
    bookmarkOutboxCount: bookmarks.length,
    noAnswerKey
  });
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
    const timer = setTimeout(() => reject(new Error(`M6 browser storage smoke timed out waiting for the real-browser callback.\n${browserStderr}`)), 20000);
    timer.unref();
  });
  const result = await Promise.race([browserResult, timeout]);

  if (result?.status !== 'pass') {
    throw new Error(`M6 IndexedDB persistence/outbox browser smoke failed: ${JSON.stringify(result)}`);
  }
  console.log('M6 real-browser IndexedDB persistence/outbox smoke passed on a loopback HTTP origin.');
} finally {
  await stopBrowser(browser);
  if (server) await new Promise((resolve) => server.close(resolve));
  await rm(fixture, { force: true });
  await rm(profileDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
