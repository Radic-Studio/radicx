begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select ok(to_regclass('private.import_batches_source_idx') is not null, 'import batch source foreign key has a covering index');
select ok(to_regclass('private.import_rows_promoted_question_idx') is not null, 'promoted-question foreign key has a covering index');
select ok(to_regclass('private.question_source_governance_reviewed_by_idx') is not null, 'source governance reviewer foreign key has a covering index');
select ok(to_regclass('public.questions_clinical_task_idx') is not null, 'question clinical-task foreign key has a covering index');
select ok(to_regclass('public.questions_cognitive_level_idx') is not null, 'question cognitive-level foreign key has a covering index');

select * from finish();
rollback;
