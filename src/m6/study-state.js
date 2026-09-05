export const M6_CONFIDENCE_LEVELS = Object.freeze([
  Object.freeze({ value: 1, key: 'guessing', label: 'Guessing' }),
  Object.freeze({ value: 3, key: 'unsure', label: 'Unsure' }),
  Object.freeze({ value: 5, key: 'confident', label: 'Confident' })
]);

export const M6_QUICK_COUNTS = Object.freeze([5, 10, 20]);
export const M6_STUDY_KINDS = Object.freeze(['study_for_me', 'subject', 'topic', 'quick', 'bookmarks']);

const safeQuestionKeys = Object.freeze([
  'position',
  'question_id',
  'revision_id',
  'revision_number',
  'state',
  'available',
  'stem',
  'options',
  'subject_id',
  'subject_name',
  'topic_id',
  'topic_name',
  'bookmarked',
  'answer'
]);

export function confidenceLabel(value) {
  return M6_CONFIDENCE_LEVELS.find((item) => item.value === Number(value))?.label ?? null;
}

export function isValidConfidence(value) {
  return M6_CONFIDENCE_LEVELS.some((item) => item.value === Number(value));
}

export function isValidQuickCount(value) {
  return M6_QUICK_COUNTS.includes(Number(value));
}

export function safeStudyQuestion(question = {}) {
  return Object.freeze(
    Object.fromEntries(safeQuestionKeys.filter((key) => key in question).map((key) => [key, question[key]]))
  );
}

export function safeStudyPackage(input = {}) {
  const session = input.session && typeof input.session === 'object' ? { ...input.session } : null;
  const questions = Array.isArray(input.questions) ? input.questions.map(safeStudyQuestion) : [];
  return Object.freeze({ session: session ? Object.freeze(session) : null, questions: Object.freeze(questions) });
}

export function createLocalItemState(question = {}, previous = null) {
  const serverAnswer = question.answer && typeof question.answer === 'object' ? question.answer : null;
  if (serverAnswer) {
    return {
      selectedOption: serverAnswer.selected_option,
      confidence: serverAnswer.confidence,
      submissionState: 'evaluated',
      feedback: { ...serverAnswer },
      bookmarked: Boolean(question.bookmarked)
    };
  }

  if (previous?.submissionState === 'pending') {
    return {
      selectedOption: previous.selectedOption ?? null,
      confidence: previous.confidence ?? null,
      submissionState: 'pending',
      feedback: null,
      bookmarked: Boolean(previous.bookmarked ?? question.bookmarked)
    };
  }

  return {
    selectedOption: previous?.selectedOption ?? null,
    confidence: previous?.confidence ?? null,
    submissionState: question.state === 'withdrawn' || question.available === false ? 'withdrawn' : 'draft',
    feedback: null,
    bookmarked: Boolean(previous?.bookmarked ?? question.bookmarked)
  };
}

function navigableQuestion(question, items = {}) {
  if (!question || question.state === 'withdrawn' || question.available === false) return false;
  return items[String(question.position)]?.submissionState !== 'withdrawn';
}

export function mergeLocalSession(packageData, previous = null) {
  const safe = safeStudyPackage(packageData);
  if (!safe.session) throw new Error('Study package is missing its session.');

  const priorItems = previous?.items ?? {};
  const items = {};
  for (const question of safe.questions) {
    items[String(question.position)] = createLocalItemState(question, priorItems[String(question.position)]);
  }

  const requestedPosition = Number(previous?.localPosition ?? safe.session.current_position ?? 1);
  const requestedQuestion = safe.questions.find((question) => Number(question.position) === requestedPosition);
  const fallbackQuestion = safe.questions.find((question) => navigableQuestion(question, items));
  const localPosition = navigableQuestion(requestedQuestion, items)
    ? requestedPosition
    : Number(safe.session.current_position ?? fallbackQuestion?.position ?? 1);

  return {
    sessionId: safe.session.id,
    deviceVersion: Number(safe.session.device_version ?? 1),
    studyKind: safe.session.study_kind,
    subjectId: safe.session.subject_id ?? null,
    topicId: safe.session.topic_id ?? null,
    targetQuestionCount: Number(safe.session.target_question_count ?? safe.questions.length),
    localPosition,
    items,
    status: safe.session.status ?? 'active',
    startedAt: safe.session.started_at ?? previous?.startedAt ?? null,
    lastActivityAt: safe.session.last_activity_at ?? previous?.lastActivityAt ?? null
  };
}

export function canSubmitLocalItem(itemState = {}) {
  return itemState.submissionState === 'draft'
    && Number.isInteger(itemState.selectedOption)
    && itemState.selectedOption >= 0
    && isValidConfidence(itemState.confidence);
}

export function nextNavigablePosition(questions = [], currentPosition, items = {}) {
  const sorted = [...questions].sort((a, b) => Number(a.position) - Number(b.position));
  for (const question of sorted) {
    const position = Number(question.position);
    if (!Number.isFinite(position) || position <= Number(currentPosition)) continue;
    if (navigableQuestion(question, items)) return position;
  }
  return null;
}

export function previousNavigablePosition(questions = [], currentPosition, items = {}) {
  const sorted = [...questions].sort((a, b) => Number(b.position) - Number(a.position));
  for (const question of sorted) {
    const position = Number(question.position);
    if (!Number.isFinite(position) || position >= Number(currentPosition)) continue;
    if (navigableQuestion(question, items)) return position;
  }
  return null;
}

export function pendingAnswerCount(localSession = {}) {
  return Object.values(localSession.items ?? {}).filter((item) => item.submissionState === 'pending').length;
}

export function evaluatedAnswerCount(localSession = {}) {
  return Object.values(localSession.items ?? {}).filter((item) => item.submissionState === 'evaluated').length;
}

export function localCompletionState(questions = [], localSession = {}) {
  const relevant = questions.filter((question) => {
    const localState = localSession.items?.[String(question.position)]?.submissionState;
    return question.state !== 'withdrawn' && question.available !== false && localState !== 'withdrawn';
  });
  const states = relevant.map((question) => localSession.items?.[String(question.position)]?.submissionState ?? 'draft');
  const pending = states.filter((state) => state === 'pending').length;
  const evaluated = states.filter((state) => state === 'evaluated').length;
  return Object.freeze({
    total: relevant.length,
    pending,
    evaluated,
    readyForServerCompletion: relevant.length > 0 && pending === 0 && evaluated === relevant.length
  });
}

export function studyModeLabel(kind) {
  const labels = {
    study_for_me: 'Study for me',
    subject: 'Subject Practice',
    topic: 'Topic Practice',
    quick: 'Quick Practice',
    bookmarks: 'Bookmarks'
  };
  return labels[kind] ?? 'Study';
}
