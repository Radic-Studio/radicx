import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { STUDY_DB_NAME, STUDY_DB_STORES, STUDY_DB_VERSION, studyCacheKey } from '../src/m6/study-db.js';
import { classifyStudySyncError, orderStudyOperations } from '../src/m6/study-sync.js';
import {
  M6_CONFIDENCE_LEVELS,
  M6_QUICK_COUNTS,
  canSubmitLocalItem,
  localCompletionState,
  mergeLocalSession,
  nextNavigablePosition,
  previousNavigablePosition,
  safeStudyQuestion,
  studyModeLabel
} from '../src/m6/study-state.js';
import { isStaleStudyError, studyErrorMessage } from '../src/m6/study-service.js';

const safePackage = {
  session: {
    id: 'session-1',
    study_kind: 'quick',
    target_question_count: 2,
    current_position: 1,
    device_version: 1,
    status: 'active',
    started_at: '2026-09-04T12:00:00Z'
  },
  questions: [
    {
      position: 1,
      question_id: 'q1',
      revision_id: 'q1',
      revision_number: 3,
      state: 'assigned',
      available: true,
      stem: 'Safe stem?',
      options: ['A', 'B'],
      subject_id: 's1',
      subject_name: 'Subject',
      topic_id: 't1',
      topic_name: 'Topic',
      bookmarked: false
    },
    {
      position: 2,
      question_id: 'q2',
      revision_id: 'q2',
      revision_number: 1,
      state: 'assigned',
      available: true,
      stem: 'Second stem?',
      options: ['A', 'B'],
      subject_id: 's1',
      subject_name: 'Subject',
      topic_id: null,
      topic_name: null,
      bookmarked: true
    }
  ]
};

test('M6 confidence and Quick Practice models match the approved contract', () => {
  assert.deepEqual(M6_CONFIDENCE_LEVELS.map((item) => item.label), ['Guessing', 'Unsure', 'Confident']);
  assert.deepEqual(M6_CONFIDENCE_LEVELS.map((item) => item.value), [1, 3, 5]);
  assert.deepEqual([...M6_QUICK_COUNTS], [5, 10, 20]);
  assert.equal(studyModeLabel('study_for_me'), 'Study for me');
});

test('browser-safe question normalization strips unapproved answer and governance fields', () => {
  const safe = safeStudyQuestion({
    ...safePackage.questions[0],
    correct_option: 1,
    explanation_private: 'secret',
    rights_status: 'owned',
    content_fingerprint: 'internal',
    reviewer_notes: 'private'
  });
  assert.equal(safe.stem, 'Safe stem?');
  assert.equal('correct_option' in safe, false);
  assert.equal('explanation_private' in safe, false);
  assert.equal('rights_status' in safe, false);
  assert.equal('content_fingerprint' in safe, false);
  assert.equal('reviewer_notes' in safe, false);
});

test('local session state keeps selection immediate and requires answer plus confidence before submission', () => {
  const local = mergeLocalSession(safePackage);
  assert.equal(local.localPosition, 1);
  assert.equal(canSubmitLocalItem(local.items['1']), false);
  local.items['1'].selectedOption = 0;
  assert.equal(canSubmitLocalItem(local.items['1']), false);
  local.items['1'].confidence = 3;
  assert.equal(canSubmitLocalItem(local.items['1']), true);
});

test('pending offline state survives server package merge until authoritative feedback arrives', () => {
  const previous = mergeLocalSession(safePackage);
  previous.items['1'] = {
    selectedOption: 1,
    confidence: 5,
    submissionState: 'pending',
    feedback: null,
    bookmarked: true
  };
  const mergedPending = mergeLocalSession(safePackage, previous);
  assert.equal(mergedPending.items['1'].submissionState, 'pending');
  assert.equal(mergedPending.items['1'].selectedOption, 1);

  const evaluatedPackage = structuredClone(safePackage);
  evaluatedPackage.questions[0].state = 'answered';
  evaluatedPackage.questions[0].answer = {
    selected_option: 1,
    confidence: 5,
    correct: true,
    correct_option: 1,
    explanation: 'Reviewed feedback',
    evaluated_at: '2026-09-04T12:01:00Z'
  };
  const mergedEvaluated = mergeLocalSession(evaluatedPackage, previous);
  assert.equal(mergedEvaluated.items['1'].submissionState, 'evaluated');
  assert.equal(mergedEvaluated.items['1'].feedback.correct, true);
});

test('cached navigation skips withdrawn questions and completion waits for authoritative evaluation', () => {
  const questions = [
    { position: 1, state: 'answered', available: true },
    { position: 2, state: 'withdrawn', available: false },
    { position: 3, state: 'assigned', available: true }
  ];
  const local = {
    items: {
      1: { submissionState: 'evaluated' },
      2: { submissionState: 'withdrawn' },
      3: { submissionState: 'pending' }
    }
  };
  assert.equal(nextNavigablePosition(questions, 1, local.items), 3);
  assert.equal(previousNavigablePosition(questions, 3), 2);
  assert.deepEqual(localCompletionState(questions, local), {
    total: 2,
    pending: 1,
    evaluated: 1,
    readyForServerCompletion: false
  });
  local.items[3].submissionState = 'evaluated';
  assert.equal(localCompletionState(questions, local).readyForServerCompletion, true);
});

test('IndexedDB foundation uses only the five approved M6 working-state stores', () => {
  assert.equal(STUDY_DB_NAME, 'radicx-study');
  assert.equal(STUDY_DB_VERSION, 1);
  assert.deepEqual([...STUDY_DB_STORES], [
    'question_cache',
    'active_sessions',
    'answer_outbox',
    'bookmark_outbox',
    'app_meta'
  ]);
  assert.equal(studyCacheKey('session', 4), 'session:4');
});

test('outbox replay ordering and stale-session classification are deterministic', () => {
  assert.deepEqual(
    orderStudyOperations([{ operationId: 'b', queuedAt: 20 }, { operationId: 'a', queuedAt: 10 }]).map((item) => item.operationId),
    ['a', 'b']
  );
  const stale = { code: '40001', message: 'study session is active on a newer device version' };
  assert.equal(isStaleStudyError(stale), true);
  assert.equal(classifyStudySyncError(stale), 'stale');
  assert.match(studyErrorMessage(stale), /changed on another device/i);
});

test('Study Home exposes only M6 modes and labels Weak Areas as unavailable', async () => {
  const html = await readFile('public/study.html', 'utf8');
  assert.match(html, />Study for me</);
  assert.match(html, /Subject Practice/);
  assert.match(html, /Topic Practice/);
  assert.match(html, /5 questions/);
  assert.match(html, /10 questions/);
  assert.match(html, /20 questions/);
  assert.match(html, />Bookmarks</);
  assert.match(html, /Weak Areas/);
  assert.match(html, /M7 will calculate weak areas/);
  assert.match(html, /Not available yet/);
  assert.doesNotMatch(html, /Readiness|Momentum|streak|achievement|mastery score/i);
});

test('Study question surface contains accessible answer, confidence, report, sync and completion controls', async () => {
  const html = await readFile('public/focus.html', 'utf8');
  assert.match(html, /<fieldset class="m6-answer-group"/);
  assert.match(html, /Choose one answer/);
  assert.match(html, /How confident are you/);
  assert.match(html, /Guessing/);
  assert.match(html, /Unsure/);
  assert.match(html, /Confident/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /<dialog[^>]+aria-labelledby="report-title"/);
  assert.match(html, /Finish Study/);
  assert.doesNotMatch(html, /timer|pass probability|mastery|readiness|momentum/i);
});

test('M6 browser code has no private table, service-role or credential access', async () => {
  const files = [
    'src/m6/study-state.js',
    'src/m6/study-db.js',
    'src/m6/study-service.js',
    'src/m6/study-sync.js',
    'src/m6/study-home.js',
    'src/m6/study-session.js',
    'public/study.html',
    'public/focus.html'
  ];
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    assert.doesNotMatch(content, /private\.question_keys|service[_-]?role|sb_secret_|database_password/i, file);
  }
});
