begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

create function pg_temp.capture_sqlstate(statement text)
returns text
language plpgsql
as $$
begin
  execute statement;
  return null;
exception when others then
  return sqlstate;
end;
$$;

insert into auth.users(id, email, aud, role) values
('c0000000-0000-0000-0000-000000000001','editor@example.invalid','authenticated','authenticated'),
('c0000000-0000-0000-0000-000000000002','clinical@example.invalid','authenticated','authenticated'),
('c0000000-0000-0000-0000-000000000003','item@example.invalid','authenticated','authenticated'),
('c0000000-0000-0000-0000-000000000004','admin@example.invalid','authenticated','authenticated'),
('c0000000-0000-0000-0000-000000000005','student@example.invalid','authenticated','authenticated');

insert into private.staff_roles(user_id, role, granted_by) values
('c0000000-0000-0000-0000-000000000001','content_editor','c0000000-0000-0000-0000-000000000004'),
('c0000000-0000-0000-0000-000000000002','clinical_reviewer','c0000000-0000-0000-0000-000000000004'),
('c0000000-0000-0000-0000-000000000003','item_reviewer','c0000000-0000-0000-0000-000000000004'),
('c0000000-0000-0000-0000-000000000004','content_admin','c0000000-0000-0000-0000-000000000004');

select has_table('public','cognitive_levels','M4 cognitive taxonomy table exists');
select has_table('public','clinical_tasks','M4 clinical-task taxonomy table exists');
select has_table('private','question_reviews','M4 private review records exist');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c0000000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal2"}', true);
select lives_ok($q$select public.admin_upsert_taxonomy_term('clinical_task','antenatal_assessment','Antenatal assessment','Synthetic M4 test term',2)$q$, 'content admin can manage taxonomy');

select set_config(
  'test.source_id',
  public.admin_create_source(
    'radicx_original',
    'Synthetic M4 governed source',
    'Synthetic fixture only',
    100,
    'owned',
    'Development-only rights fixture',
    null,
    null
  )::text,
  true
);
select ok(current_setting('test.source_id')::uuid is not null, 'content admin can create governed source');

select set_config('request.jwt.claims','{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select set_config(
  'test.question_id',
  public.admin_create_question(
    '20000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000003',
    current_setting('test.source_id')::uuid,
    'Synthetic M4 workflow fixture: which option is designated for the test?',
    '["Alpha","Beta","Gamma","Delta"]'::jsonb,
    'application',
    'development_fixture',
    'standard',
    2,
    'Private development-only explanation.'
  )::text,
  true
);
select ok(current_setting('test.question_id')::uuid is not null, 'content editor can create a classified draft question');

select set_config('request.jwt.claims','{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
select is(
  pg_temp.capture_sqlstate($q$select public.admin_create_question(
    '20000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000003',
    current_setting('test.source_id')::uuid,
    'AAL1 must not create this question',
    '["A","B"]'::jsonb,
    'application','development_fixture','standard',0,null
  )$q$),
  '42501',
  'AAL1 cannot perform content administration'
);

select set_config('request.jwt.claims','{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  format('select public.admin_submit_question_for_review(%L::uuid)', current_setting('test.question_id')),
  'content editor can submit a draft for review'
);

select set_config('request.jwt.claims','{"sub":"c0000000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal2"}', true);
select is(
  pg_temp.capture_sqlstate(format('select public.admin_publish_question(%L::uuid)', current_setting('test.question_id'))),
  '55000',
  'publication is blocked before review gates pass'
);
select lives_ok(
  format('select public.admin_record_question_review(%L::uuid, %L, %L, null, false)', current_setting('test.question_id'), 'rights', 'approved'),
  'content admin can approve rights review'
);

select set_config('request.jwt.claims','{"sub":"c0000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  format('select public.admin_record_question_review(%L::uuid, %L, %L, null, false)', current_setting('test.question_id'), 'clinical', 'approved'),
  'clinical reviewer can approve clinical review'
);

select set_config('request.jwt.claims','{"sub":"c0000000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  format('select public.admin_record_question_review(%L::uuid, %L, %L, null, false)', current_setting('test.question_id'), 'item', 'approved'),
  'item reviewer can approve item review'
);

select set_config('request.jwt.claims','{"sub":"c0000000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal2"}', true);
select ok(
  (public.admin_question_gate_status(current_setting('test.question_id')::uuid) ->> 'publishable')::boolean,
  'publication gate reports the fully reviewed question as publishable'
);
select lives_ok(
  format('select public.admin_publish_question(%L::uuid)', current_setting('test.question_id')),
  'content admin can publish after all gates pass'
);

reset role;
select is(
  pg_temp.capture_sqlstate(format('update public.questions set risk_tier=%L where id=%L::uuid', 'high', current_setting('test.question_id'))),
  'P0001',
  'published M4 governance fields remain immutable'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select is(pg_temp.capture_sqlstate('select * from private.question_keys'), '42501', 'content staff cannot query private answer-key storage');
select is(pg_temp.capture_sqlstate('select * from private.question_source_governance'), '42501', 'content staff cannot query restricted source governance directly');
select is(pg_temp.capture_sqlstate('select * from private.import_rows'), '42501', 'content staff cannot query raw import rows directly');

select set_config(
  'test.revision_id',
  public.admin_create_question_revision(current_setting('test.question_id')::uuid)::text,
  true
);
select ok(current_setting('test.revision_id')::uuid is not null, 'content editor can create a new draft revision without reading the key');

reset role;
select is(
  (select revision_number from public.questions where id = current_setting('test.revision_id')::uuid),
  2,
  'new question revision increments revision number'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c0000000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  format('select public.admin_quarantine_question(%L::uuid, %L)', current_setting('test.question_id'), 'Synthetic quarantine validation'),
  'content admin can quarantine a published problem question'
);

select set_config('request.jwt.claims','{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select set_config(
  'test.batch_id',
  public.admin_create_import_batch(
    current_setting('test.source_id')::uuid,
    'm4-fixture.csv',
    repeat('a',64),
    '{"stem":"stem","options":"options"}'::jsonb
  )::text,
  true
);
select ok(current_setting('test.batch_id')::uuid is not null, 'content editor can create an idempotent import batch');

select set_config(
  'test.import_row_id',
  public.admin_stage_import_row(
    current_setting('test.batch_id')::uuid,
    1,
    jsonb_build_object(
      'subject_id','20000000-0000-0000-0000-000000000002',
      'topic_id','30000000-0000-0000-0000-000000000003',
      'stem','Synthetic M4 imported row: select the designated test option.',
      'options',jsonb_build_array('One','Two','Three','Four'),
      'cognitive_level','application',
      'clinical_task','development_fixture',
      'risk_tier','standard',
      'correct_option',1,
      'explanation_private','Private import fixture explanation.'
    )
  )::text,
  true
);
select ok(current_setting('test.import_row_id')::uuid is not null, 'valid structured import row enters private staging');

select set_config(
  'test.import_question_id',
  public.admin_promote_import_row_to_draft(current_setting('test.import_row_id')::uuid)::text,
  true
);
select ok(current_setting('test.import_question_id')::uuid is not null, 'valid import row promotes only to draft');

reset role;
select is(
  (select status from public.questions where id = current_setting('test.import_question_id')::uuid),
  'draft'::public.question_status,
  'import workflow never publishes directly'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select set_config(
  'test.duplicate_row_id',
  public.admin_stage_import_row(
    current_setting('test.batch_id')::uuid,
    2,
    jsonb_build_object(
      'subject_id','20000000-0000-0000-0000-000000000001',
      'topic_id','30000000-0000-0000-0000-000000000002',
      'stem','Synthetic anatomy fixture: which option is marked as the correct development answer?',
      'options','["Option A","Option B","Option C","Option D"]'::jsonb,
      'cognitive_level','recall',
      'clinical_task','development_fixture',
      'correct_option',1
    )
  )::text,
  true
);

reset role;
select is(
  (select status from private.import_rows where id = current_setting('test.duplicate_row_id')::uuid),
  'duplicate'::private.import_row_status,
  'import staging detects duplicate question fingerprints'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c0000000-0000-0000-0000-000000000005","role":"authenticated","aal":"aal2","user_metadata":{"role":"content_admin"}}', true);
select is(
  pg_temp.capture_sqlstate('select * from public.admin_list_questions(null, 10)'),
  '42501',
  'student cannot forge metadata to access admin question listing'
);

select set_config('request.jwt.claims','{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  $q$insert into storage.objects(bucket_id,name) values ('admin-uploads','c0000000-0000-0000-0000-000000000001/m4-upload.csv')$q$,
  'content staff can upload only to their private admin-upload prefix'
);
select is(
  pg_temp.capture_sqlstate($q$insert into storage.objects(bucket_id,name) values ('source-evidence','c0000000-0000-0000-0000-000000000001/evidence.pdf')$q$),
  '42501',
  'non-admin content staff cannot upload restricted source evidence'
);

select set_config('request.jwt.claims','{"sub":"c0000000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  $q$insert into storage.objects(bucket_id,name) values ('source-evidence','c0000000-0000-0000-0000-000000000004/evidence.pdf')$q$,
  'content admin can upload source evidence to their private prefix'
);

reset role;
select ok((select count(*) from private.content_audit_log) >= 10, 'content-critical M4 actions are written to the audit log');
select ok((select count(*) from private.question_keys where question_id in (current_setting('test.revision_id')::uuid,current_setting('test.import_question_id')::uuid)) = 2, 'revision and import workflows keep answer keys inside private storage');
select is((select status from public.questions where id = current_setting('test.question_id')::uuid), 'quarantined'::public.question_status, 'quarantine preserves the published revision as a non-deleted record');

select * from finish();
rollback;
