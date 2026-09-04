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
await rm(profileDir, { recursive: true, force: true });

const html = `<!doctype html>
<html lang="en" data-m6-storage="running">
<head><meta charset="utf-8"><title>M6 storage smoke</title></head>
<body>
<script type="module">
import {
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
} from './assets/m6/study-db.js';

try {
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

  document.documentElement.dataset.m6Storage = pass ? 'pass' : 'fail';
  if (!pass) {
    document.body.textContent = JSON.stringify({ actualStores, expectedStores, cached, answers, bookmarks, noAnswerKey });
  }
} catch (error) {
  document.documentElement.dataset.m6Storage = 'error';
  document.body.textContent = String(error?.stack ?? error);
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

async function runChrome(url) {
  return new Promise((resolve, reject) => {
    const child = spawn(chrome, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--user-data-dir=${profileDir}`,
      '--virtual-time-budget=4000',
      '--dump-dom',
      url
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('M6 browser storage smoke timed out waiting for Chromium.'));
    }, 15000);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`Chromium exited with code ${code}.\n${stderr}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

await writeFile(fixture, html, 'utf8');
let server;
try {
  server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
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
    } catch {
      response.writeHead(404).end('Not found');
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('M6 browser storage smoke could not determine its loopback port.');

  const { stdout, stderr } = await runChrome(`http://127.0.0.1:${address.port}/m6-storage-smoke.html`);
  if (!/data-m6-storage="pass"/.test(stdout)) {
    console.error(stdout);
    if (stderr) console.error(stderr);
    throw new Error('M6 IndexedDB persistence/outbox browser smoke failed.');
  }
  console.log('M6 real-browser IndexedDB persistence/outbox smoke passed on a loopback HTTP origin.');
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await rm(fixture, { force: true });
  await rm(profileDir, { recursive: true, force: true });
}
