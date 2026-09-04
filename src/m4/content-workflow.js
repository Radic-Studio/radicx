export const M4_PUBLICATION_STAGES = Object.freeze([
  'Capture',
  'Author / Transcribe',
  'Duplicate Check',
  'Rights Check',
  'Clinical Review',
  'Item Review',
  'Approve',
  'Publish',
  'Live Analysis',
]);

export const M4_IMPORT_STAGES = Object.freeze([
  'Upload',
  'Parse',
  'Map',
  'Validate',
  'Preview',
  'Dedupe',
  'Staging',
  'Review',
  'Draft',
]);

export const M4_SOURCE_CLASSES = Object.freeze([
  ['verified_past_question', 'Verified Past Question'],
  ['reported_past_question', 'Reported Past Question'],
  ['licensed_question', 'Licensed Question'],
  ['radicx_original', 'RadicX Original'],
  ['radicx_clinical_scenario', 'RadicX Clinical Scenario'],
  ['ai_assisted_draft', 'AI-Assisted Draft'],
]);

export const M4_QUALITY_DIMENSIONS = Object.freeze([
  'Provenance confidence',
  'Rights status',
  'Clinical validity',
  'Item-writing quality',
  'Educational relevance',
  'Psychometric performance',
  'Freshness / review date',
]);

const requiredGateKeys = Object.freeze([
  'rights_ok',
  'clinical_ok',
  'item_ok',
  'enhanced_review_ok',
  'taxonomy_ok',
  'answer_key_present',
]);

export function summarizePublicationGate(gate = {}) {
  const checks = requiredGateKeys.map((key) => ({ key, passed: gate[key] === true }));
  const missing = checks.filter((check) => !check.passed).map((check) => check.key);
  return Object.freeze({
    status: typeof gate.status === 'string' ? gate.status : 'unknown',
    publishable: gate.publishable === true && missing.length === 0,
    checks,
    missing,
  });
}

export function normalizeTaxonomyCode(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function preflightImportRow(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return ['invalid_payload'];

  const stem = typeof payload.stem === 'string' ? payload.stem.trim() : '';
  if (!stem) errors.push('missing_stem');

  if (!Array.isArray(payload.options) || payload.options.length < 2 || payload.options.length > 10) {
    errors.push('invalid_options');
  } else if (payload.options.some((option) => typeof option !== 'string' || !option.trim())) {
    errors.push('invalid_options');
  }

  if (!Number.isInteger(payload.correct_option)) errors.push('invalid_correct_option');
  else if (Array.isArray(payload.options) && (payload.correct_option < 0 || payload.correct_option >= payload.options.length)) {
    errors.push('invalid_correct_option');
  }

  if (typeof payload.subject_id !== 'string' || !payload.subject_id.trim()) errors.push('missing_subject_id');
  if (typeof payload.cognitive_level !== 'string' || !payload.cognitive_level.trim()) errors.push('missing_cognitive_level');
  if (typeof payload.clinical_task !== 'string' || !payload.clinical_task.trim()) errors.push('missing_clinical_task');

  return [...new Set(errors)];
}

export function getSafeQuestionSummary(question = {}) {
  const allowed = [
    'id',
    'revision_group_id',
    'revision_number',
    'status',
    'subject_id',
    'topic_id',
    'source_id',
    'stem',
    'options',
    'cognitive_level',
    'clinical_task',
    'risk_tier',
    'published_at',
    'updated_at',
  ];

  return Object.freeze(Object.fromEntries(allowed.filter((key) => key in question).map((key) => [key, question[key]])));
}
