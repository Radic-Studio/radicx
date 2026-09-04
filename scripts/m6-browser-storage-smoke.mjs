import { execFileSync } from 'node:child_process';
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

const fixture = path.resolve('dist/m6-storage-smoke.html');
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
  const databases = indexedDB.databases ? await indexedDB.databases() : [];
  const noAnswerKey = !JSON.stringify(cached).includes('correct_option') && !JSON.stringify(cached).includes('explanation_private');
  const pass = cached?.questions?.length === 1
    && cached?.localSession?.items?.['1']?.selectedOption === 2
    && cached?.localSession?.items?.['1']?.confidence === 3
    && answers.length === 1
    && bookmarks.length === 1
    && noAnswerKey
    && STUDY_DB_STORES.length === 5
    && (!indexedDB.databases || databases.some((db) => db.name === 'radicx-study'));
  document.documentElement.dataset.m6Storage = pass ? 'pass' : 'fail';
} catch (error) {
  document.documentElement.dataset.m6Storage = 'error';
  document.body.textContent = String(error?.stack ?? error);
}
</script>
</body></html>`;

await writeFile(fixture, html, 'utf8');
try {
  const output = execFileSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--allow-file-access-from-files',
    `--user-data-dir=${profileDir}`,
    '--virtual-time-budget=2500',
    '--dump-dom',
    `file://${fixture}`
  ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

  if (!/data-m6-storage="pass"/.test(output)) {
    console.error(output);
    throw new Error('M6 IndexedDB persistence/outbox browser smoke failed.');
  }
  console.log('M6 real-browser IndexedDB persistence/outbox smoke passed.');
} finally {
  await rm(fixture, { force: true });
  await rm(profileDir, { recursive: true, force: true });
}
