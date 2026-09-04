import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  M4_IMPORT_STAGES,
  M4_PUBLICATION_STAGES,
  M4_QUALITY_DIMENSIONS,
  M4_SOURCE_CLASSES,
  getSafeQuestionSummary,
  normalizeTaxonomyCode,
  preflightImportRow,
  summarizePublicationGate,
} from '../src/m4/content-workflow.js';

async function text(path) {
  return readFile(path, 'utf8');
}

test('M4 publication and import workflows match the controlled brief', () => {
  assert.deepEqual(M4_PUBLICATION_STAGES, [
    'Capture', 'Author / Transcribe', 'Duplicate Check', 'Rights Check',
    'Clinical Review', 'Item Review', 'Approve', 'Publish', 'Live Analysis',
  ]);
  assert.deepEqual(M4_IMPORT_STAGES, [
    'Upload', 'Parse', 'Map', 'Validate', 'Preview', 'Dedupe', 'Staging', 'Review', 'Draft',
  ]);
});

test('M4 source classes and quality dimensions remain explicit and independent', () => {
  assert.equal(M4_SOURCE_CLASSES.length, 6);
  for (const code of [
    'verified_past_question', 'reported_past_question', 'licensed_question',
    'radicx_original', 'radicx_clinical_scenario', 'ai_assisted_draft',
  ]) {
    assert.ok(M4_SOURCE_CLASSES.some(([value]) => value === code), `missing source class ${code}`);
  }
  for (const label of ['Provenance confidence', 'Rights status', 'Clinical validity', 'Item-writing quality', 'Educational relevance', 'Freshness / review date']) {
    assert.ok(M4_QUALITY_DIMENSIONS.includes(label), `missing quality dimension ${label}`);
  }
});

test('publication gate summary requires every server-side check', () => {
  const pass = summarizePublicationGate({
    status: 'review',
    rights_ok: true,
    clinical_ok: true,
    item_ok: true,
    enhanced_review_ok: true,
    taxonomy_ok: true,
    answer_key_present: true,
    publishable: true,
  });
  assert.equal(pass.publishable, true);
  assert.deepEqual(pass.missing, []);

  const fail = summarizePublicationGate({
    status: 'review',
    rights_ok: true,
    clinical_ok: false,
    item_ok: true,
    enhanced_review_ok: true,
    taxonomy_ok: true,
    answer_key_present: true,
    publishable: true,
  });
  assert.equal(fail.publishable, false);
  assert.deepEqual(fail.missing, ['clinical_ok']);
});

test('import preflight catches unsafe or incomplete structured rows', () => {
  assert.deepEqual(preflightImportRow({
    subject_id: 'subject',
    cognitive_level: 'application',
    clinical_task: 'assessment',
    stem: 'Question?',
    options: ['A', 'B'],
    correct_option: 1,
  }), []);

  const errors = preflightImportRow({ stem: '', options: ['A', ''], correct_option: 3 });
  for (const expected of ['missing_stem', 'invalid_options', 'invalid_correct_option', 'missing_subject_id', 'missing_cognitive_level', 'missing_clinical_task']) {
    assert.ok(errors.includes(expected), `missing import error ${expected}`);
  }
});

test('taxonomy normalization is deterministic without inventing taxonomy terms', () => {
  assert.equal(normalizeTaxonomyCode('  Antenatal Assessment  '), 'antenatal_assessment');
  assert.equal(normalizeTaxonomyCode('Complicated / Labour'), 'complicated_labour');
  assert.equal(normalizeTaxonomyCode(''), '');
});

test('safe question summaries never copy answer-bearing private fields', () => {
  const summary = getSafeQuestionSummary({
    id: 'q1',
    stem: 'Safe stem',
    options: ['A', 'B'],
    status: 'draft',
    correct_option: 1,
    explanation_private: 'must not leak',
    reviewer_notes: 'private',
  });
  assert.equal(summary.id, 'q1');
  assert.equal('correct_option' in summary, false);
  assert.equal('explanation_private' in summary, false);
  assert.equal('reviewer_notes' in summary, false);
});

test('M4 admin surface exposes governance workflows but no answer keys', async () => {
  const html = await text('public/admin.html');
  for (const label of [
    'Question Intelligence', 'Capture', 'Duplicate Check', 'Rights Check', 'Clinical Review',
    'Item Review', 'Structured imports never publish directly', 'Revision', 'Quarantine', 'Audit',
  ]) {
    assert.ok(html.includes(label), `admin surface missing ${label}`);
  }
  assert.match(html, /AAL2 staff only/);
  assert.match(html, /Stored answer keys never render on this surface/);
  assert.doesNotMatch(html, /correct_option\s*[:=]\s*[0-9]/i);
});

test('M4 migrations contain required private boundaries and server-authoritative gates', async () => {
  const schema = await text('supabase/migrations/20260904090000_m4_content_governance.sql');
  const workflows = await text('supabase/migrations/20260904090100_m4_admin_workflows.sql');

  for (const object of [
    'private.question_source_governance', 'private.question_governance', 'private.question_reviews',
    'private.import_batches', 'private.import_rows', 'private.content_audit_log',
  ]) assert.ok(schema.includes(object), `missing M4 private object ${object}`);

  for (const contract of [
    'admin_create_question', 'admin_record_question_review', 'admin_publish_question',
    'admin_create_question_revision', 'admin_quarantine_question', 'admin_create_import_batch',
    'admin_stage_import_row', 'admin_promote_import_row_to_draft', 'admin_question_gate_status',
  ]) assert.ok(workflows.includes(contract), `missing M4 admin contract ${contract}`);

  assert.match(workflows, /AAL2 is required/);
  assert.match(workflows, /publication gates are not satisfied/);
  assert.match(workflows, /only valid staged import rows can be promoted/);
});

test('M4 does not modify or replace accepted M2/M3 foundations', async () => {
  const required = [
    'supabase/migrations/20260904030000_m2_core_schema.sql',
    'supabase/migrations/20260904030100_m2_security_rls.sql',
    'supabase/migrations/20260904030200_m2_integrity_indexes_storage.sql',
    'supabase/migrations/20260904030300_m2_published_question_immutability.sql',
    'supabase/migrations/20260904054500_m2_advisor_indexes.sql',
    'supabase/migrations/20260904054800_m2_private_table_rls.sql',
    'src/design-system/tokens.css',
    'src/design-system/components.css',
    'src/design-system/shells.css',
  ];
  for (const path of required) assert.ok((await text(path)).length > 0, `${path} must remain present`);
});
