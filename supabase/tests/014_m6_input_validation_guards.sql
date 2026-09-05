begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

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
('a6140000-0000-0000-0000-000000000001','m6-input-guards@example.invalid','authenticated','authenticated');

update public.profiles
set programme_id = '10000000-0000-0000-0000-000000000001',
    expected_exam_date = current_date + 90,
    daily_study_minutes = 20,
    onboarding_status = 'completed',
    onboarding_current_step = 4,
    diagnostic_invitation_decision = 'skip'
where user_id = 'a6140000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a6140000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

select is(
  pg_temp.capture_sqlstate(
    $q$select public.study_start_session(null::text, null, null, null, 'a6140000-0000-0000-0000-000000000101'::uuid)$q$
  ),
  '22023',
  'Study start rejects a NULL mode explicitly'
);

select is(
  pg_temp.capture_sqlstate(
    $q$select public.study_start_session('quick', null, null, null, 'a6140000-0000-0000-0000-000000000102'::uuid)$q$
  ),
  '22023',
  'Quick Practice rejects a NULL question count explicitly'
);

select is(
  jsonb_array_length(
    public.study_start_session(
      'quick', null, null, 5,
      'a6140000-0000-0000-0000-000000000103'::uuid
    ) -> 'questions'
  ),
  5,
  'Valid input still starts a five-question Quick Practice session'
);

select is(
  pg_temp.capture_sqlstate(
    $q$select public.study_submit_answer(
      (select id from public.sessions where start_operation_id = 'a6140000-0000-0000-0000-000000000103'::uuid),
      (select current_question_id from public.sessions where start_operation_id = 'a6140000-0000-0000-0000-000000000103'::uuid),
      0, 3, 'a6140000-0000-0000-0000-000000000201'::uuid, null
    )$q$
  ),
  '22023',
  'Answer submission rejects a NULL device version'
);

select is(
  pg_temp.capture_sqlstate(
    $q$select public.study_submit_answer(
      (select id from public.sessions where start_operation_id = 'a6140000-0000-0000-0000-000000000103'::uuid),
      (select current_question_id from public.sessions where start_operation_id = 'a6140000-0000-0000-0000-000000000103'::uuid),
      null, 3, 'a6140000-0000-0000-0000-000000000202'::uuid, 1
    )$q$
  ),
  '22023',
  'Answer submission rejects a NULL selected option'
);

select is(
  pg_temp.capture_sqlstate(
    $q$select public.study_submit_answer(
      (select id from public.sessions where start_operation_id = 'a6140000-0000-0000-0000-000000000103'::uuid),
      (select current_question_id from public.sessions where start_operation_id = 'a6140000-0000-0000-0000-000000000103'::uuid),
      0, null, 'a6140000-0000-0000-0000-000000000203'::uuid, 1
    )$q$
  ),
  '22023',
  'Answer submission rejects NULL confidence'
);

select is(
  (select count(*) from public.session_answers where user_id = 'a6140000-0000-0000-0000-000000000001'),
  0::bigint,
  'Rejected nullable answer inputs cannot create historical evidence'
);

select is(
  pg_temp.capture_sqlstate(
    $q$select public.study_set_bookmark(
      (select id from public.sessions where start_operation_id = 'a6140000-0000-0000-0000-000000000103'::uuid),
      (select current_question_id from public.sessions where start_operation_id = 'a6140000-0000-0000-0000-000000000103'::uuid),
      null, 'a6140000-0000-0000-0000-000000000301'::uuid, 1, 1
    )$q$
  ),
  '22023',
  'Bookmark mutation rejects a NULL desired state'
);

select is(
  pg_temp.capture_sqlstate(
    $q$select public.study_set_bookmark(
      (select id from public.sessions where start_operation_id = 'a6140000-0000-0000-0000-000000000103'::uuid),
      (select current_question_id from public.sessions where start_operation_id = 'a6140000-0000-0000-0000-000000000103'::uuid),
      true, 'a6140000-0000-0000-0000-000000000302'::uuid, null, 1
    )$q$
  ),
  '22023',
  'Bookmark mutation rejects a NULL operation sequence'
);

select is(
  pg_temp.capture_sqlstate(
    $q$select public.study_set_bookmark(
      (select id from public.sessions where start_operation_id = 'a6140000-0000-0000-0000-000000000103'::uuid),
      (select current_question_id from public.sessions where start_operation_id = 'a6140000-0000-0000-0000-000000000103'::uuid),
      true, 'a6140000-0000-0000-0000-000000000303'::uuid, 1, null
    )$q$
  ),
  '22023',
  'Bookmark mutation rejects a NULL device version'
);

select is(
  pg_temp.capture_sqlstate(
    $q$select public.study_report_question(
      (select id from public.sessions where start_operation_id = 'a6140000-0000-0000-0000-000000000103'::uuid),
      (select current_question_id from public.sessions where start_operation_id = 'a6140000-0000-0000-0000-000000000103'::uuid),
      null, 'invalid category'
    )$q$
  ),
  '22023',
  'Question report rejects a NULL category explicitly'
);

select is(
  pg_temp.capture_sqlstate(
    $q$select public.study_complete_session(
      (select id from public.sessions where start_operation_id = 'a6140000-0000-0000-0000-000000000103'::uuid),
      null
    )$q$
  ),
  '22023',
  'Study completion rejects a NULL device version'
);

select * from finish();
rollback;
