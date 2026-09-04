-- Cover M4 foreign keys reported by Supabase Performance Advisor.
-- These indexes support referential maintenance and the expected governance/import lookup paths.

create index import_batches_source_idx
  on private.import_batches(source_id);

create index import_rows_promoted_question_idx
  on private.import_rows(promoted_question_id);

create index question_source_governance_reviewed_by_idx
  on private.question_source_governance(reviewed_by);

create index questions_clinical_task_idx
  on public.questions(clinical_task);

create index questions_cognitive_level_idx
  on public.questions(cognitive_level);
