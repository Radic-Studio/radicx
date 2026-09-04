begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

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

create function pg_temp.answer_remaining(p_session_id uuid, p_device_version integer)
returns integer
language plpgsql
as $$
declare
  qid uuid;
  answered integer := 0;
begin
  loop
    select current_question_id into qid
    from public.sessions
    where id = p_session_id;

    exit when qid is null;
    perform public.study_submit_answer(
      p_session_id,
      qid,
      0,
      3,
      extensions.gen_random_uuid(),
      p_device_version
    );
    answered := answered + 1;
  end loop;
  return answered;
end;
$$;

insert into auth.users(id, email, aud, role) values
('a6000000-0000-0000-0000-000000000001','m6-student-a@example.invalid','authenticated','authenticated'),
('b6000000-0000-0000-0000-000000000001','m6-student-b@example.invalid','authenticated','authenticated');

update public.profiles
set programme_id = '10000000-0000-0000-0000-000000000001',
    expected_exam_date = current_date + 90,
    daily_study_minutes = 20,
    onboarding_status = 'completed',
    onboarding_current_step = 4,
    diagnostic_invitation_decision = 'skip'
where user_id in (
  'a6000000-0000-0000-0000-000000000001',
  'b6000000-0000-0000-0000-000000000001'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a6000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);

select is(
  pg_temp.capture_sqlstate('select * from private.question_keys'),
  '42501',
  'M6 student cannot read private answer keys'
);

select is(
  pg_temp.capture_sqlstate('select * from public.questions'),
  '42501',
  'M6 student cannot retrieve arbitrary whole question rows'
);

select is(
  jsonb_array_length(
    public.study_start_session(
      'quick', null, null, 5,
      'a6000000-0000-0000-0000-000000000101'::uuid
    ) -> 'questions'
  ),
  5,
  'Quick Practice 5 creates a five-question safe package'
);

select ok(
  position('correct_option' in public.study_resume_session(
    (select id from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    1
  )::text) = 0,
  'Pre-submit Study package contains no correct-option field'
);

select ok(
  position('Synthetic private explanation' in public.study_resume_session(
    (select id from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    1
  )::text) = 0,
  'Pre-submit Study package contains no private explanation'
);

select ok(
  position('content_fingerprint' in public.study_resume_session(
    (select id from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    1
  )::text) = 0
  and position('rights_status' in public.study_resume_session(
    (select id from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    1
  )::text) = 0,
  'Safe Study package excludes governance/internal metadata'
);

select is(
  (select count(*) from public.study_session_items where session_id = (
    select id from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid
  )),
  5::bigint,
  'Authoritative Study manifest persists five assigned revisions'
);

reset role;
select ok(
  not exists (
    select 1
    from public.study_session_items i
    join public.questions q on q.id = i.question_id
    where i.session_id = (
      select id from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid
    )
      and i.revision_number <> q.revision_number
  ),
  'Manifest stores the exact question revision number assigned'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a6000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);

select is(
  pg_temp.capture_sqlstate($q$update public.sessions set status = 'abandoned' where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid$q$),
  '42501',
  'Student cannot directly mutate an M6 Study session'
);

select is(
  pg_temp.capture_sqlstate(format(
    $q$insert into public.session_answers(session_id,user_id,question_id,selected_option,confidence,operation_id) values (%L::uuid,%L::uuid,%L::uuid,0,3,%L::uuid)$q$,
    (select id::text from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    'a6000000-0000-0000-0000-000000000001',
    (select current_question_id::text from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    'a6000000-0000-0000-0000-000000000199'
  )),
  '42501',
  'Student cannot bypass Study RPC with direct answer insert'
);

select is(
  (public.study_submit_answer(
    (select id from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    (select current_question_id from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    0, 3,
    'a6000000-0000-0000-0000-000000000201'::uuid,
    1
  ) ->> 'status'),
  'evaluated',
  'Authoritative answer operation evaluates the current assigned question'
);

select ok(
  (public.study_submit_answer(
    (select id from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    (select question_id from public.session_answers where operation_id = 'a6000000-0000-0000-0000-000000000201'::uuid),
    3, 5,
    'a6000000-0000-0000-0000-000000000201'::uuid,
    1
  ) ? 'correct_option')
  and (public.study_submit_answer(
    (select id from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    (select question_id from public.session_answers where operation_id = 'a6000000-0000-0000-0000-000000000201'::uuid),
    3, 5,
    'a6000000-0000-0000-0000-000000000201'::uuid,
    1
  ) ? 'explanation'),
  'Only post-submit evaluation returns individual correct-option/explanation feedback'
);

select is(
  (public.study_submit_answer(
    (select id from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    (select question_id from public.session_answers where operation_id = 'a6000000-0000-0000-0000-000000000201'::uuid),
    3, 5,
    'a6000000-0000-0000-0000-000000000201'::uuid,
    1
  ) ->> 'selected_option')::integer,
  0,
  'Duplicate answer operation ID is idempotent and cannot change the committed option'
);

select is(
  pg_temp.capture_sqlstate(format(
    $q$select public.study_submit_answer(%L::uuid,%L::uuid,1,3,%L::uuid,1)$q$,
    (select id::text from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    (select question_id::text from public.session_answers where operation_id = 'a6000000-0000-0000-0000-000000000201'::uuid),
    'a6000000-0000-0000-0000-000000000202'
  )),
  '55000',
  'A second final answer cannot be used to brute-force correctness'
);

select is(
  pg_temp.capture_sqlstate(format(
    $q$select public.study_submit_answer(%L::uuid,%L::uuid,99,3,%L::uuid,1)$q$,
    (select id::text from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    (select current_question_id::text from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    'a6000000-0000-0000-0000-000000000203'
  )),
  '22023',
  'Study answer rejects an option outside the assigned option set'
);

select is(
  pg_temp.capture_sqlstate(format(
    $q$select public.study_submit_answer(%L::uuid,%L::uuid,0,2,%L::uuid,1)$q$,
    (select id::text from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    (select current_question_id::text from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    'a6000000-0000-0000-0000-000000000204'
  )),
  '22023',
  'Study answer accepts only Guessing, Unsure or Confident confidence values'
);

select is(
  pg_temp.capture_sqlstate(format(
    $q$update public.session_answers set is_correct = true where operation_id = %L::uuid$q$,
    'a6000000-0000-0000-0000-000000000201'
  )),
  '42501',
  'Student cannot modify server-owned correctness'
);

select ok(
  (public.study_set_bookmark(
    (select id from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    (select question_id from public.session_answers where operation_id = 'a6000000-0000-0000-0000-000000000201'::uuid),
    true,
    'a6000000-0000-0000-0000-000000000301'::uuid,
    1, 1
  ) ->> 'bookmarked')::boolean,
  'Bookmark RPC applies an owned-manifest bookmark'
);

select ok(
  not (public.study_set_bookmark(
    (select id from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    (select question_id from public.session_answers where operation_id = 'a6000000-0000-0000-0000-000000000201'::uuid),
    false,
    'a6000000-0000-0000-0000-000000000302'::uuid,
    2, 1
  ) ->> 'bookmarked')::boolean,
  'Newer bookmark operation can remove the bookmark'
);

select ok(
  not (public.study_set_bookmark(
    (select id from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    (select question_id from public.session_answers where operation_id = 'a6000000-0000-0000-0000-000000000201'::uuid),
    true,
    'a6000000-0000-0000-0000-000000000303'::uuid,
    1, 1
  ) ->> 'bookmarked')::boolean,
  'Stale bookmark sequence cannot overwrite a newer desired state'
);

select ok(
  (public.study_set_bookmark(
    (select id from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    (select question_id from public.session_answers where operation_id = 'a6000000-0000-0000-0000-000000000201'::uuid),
    true,
    'a6000000-0000-0000-0000-000000000304'::uuid,
    3, 1
  ) ->> 'bookmarked')::boolean,
  'Latest bookmark state is retained for Bookmark Practice'
);

select is(
  public.study_report_question(
    (select id from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    (select question_id from public.session_answers where operation_id = 'a6000000-0000-0000-0000-000000000201'::uuid),
    'typo',
    'Synthetic M6 report'
  ),
  public.study_report_question(
    (select id from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    (select question_id from public.session_answers where operation_id = 'a6000000-0000-0000-0000-000000000201'::uuid),
    'typo',
    'Synthetic M6 report replay'
  ),
  'Duplicate open report within 24 hours reuses the existing report'
);

select is(
  pg_temp.capture_sqlstate(format(
    $q$insert into public.question_reports(user_id,question_id,category) values (%L::uuid,%L::uuid,'other')$q$,
    'a6000000-0000-0000-0000-000000000001',
    (select question_id::text from public.session_answers where operation_id = 'a6000000-0000-0000-0000-000000000201'::uuid)
  )),
  '42501',
  'Student cannot bypass Study report validation with direct insert'
);

select set_config('request.jwt.claims','{"sub":"b6000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
select is(
  (select count(*) from public.study_session_items where session_id = (
    select id from public.sessions where user_id = 'a6000000-0000-0000-0000-000000000001' order by created_at limit 1
  )),
  0::bigint,
  'Student B cannot read Student A Study manifest'
);

select is(
  pg_temp.capture_sqlstate(format(
    $q$select public.study_resume_session(%L::uuid,1)$q$,
    (select id::text from public.sessions where user_id = 'a6000000-0000-0000-0000-000000000001' order by created_at limit 1)
  )),
  'P0002',
  'Student B cannot resume Student A Study session'
);

select is(
  pg_temp.capture_sqlstate(format(
    $q$select public.study_submit_answer(%L::uuid,%L::uuid,0,3,%L::uuid,1)$q$,
    (select id::text from public.sessions where user_id = 'a6000000-0000-0000-0000-000000000001' order by created_at limit 1),
    (select current_question_id::text from public.sessions where user_id = 'a6000000-0000-0000-0000-000000000001' order by created_at limit 1),
    'b6000000-0000-0000-0000-000000000201'
  )),
  'P0002',
  'Student B cannot answer for Student A'
);

select set_config('request.jwt.claims','{"sub":"a6000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);

select is(
  (public.study_resume_session(
    (select id from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    null
  ) -> 'session' ->> 'device_version')::integer,
  2,
  'Resume without a known local version claims the Study session with a new device version'
);

select is(
  pg_temp.capture_sqlstate(format(
    $q$select public.study_submit_answer(%L::uuid,%L::uuid,0,3,%L::uuid,1)$q$,
    (select id::text from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    (select current_question_id::text from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    'a6000000-0000-0000-0000-000000000205'
  )),
  '40001',
  'Stale device version cannot commit a Study answer'
);

reset role;
update public.questions
set status = 'quarantined'
where id = (
  select current_question_id from public.sessions
  where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a6000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
select is(
  (select count(*) from jsonb_array_elements(public.study_resume_session(
    (select id from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    2
  ) -> 'questions') item
   where item ->> 'state' = 'withdrawn'),
  1::bigint,
  'A question quarantined after assignment is withdrawn before submission'
);

select is(
  pg_temp.answer_remaining(
    (select id from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    2
  ),
  3,
  'Remaining eligible cached Study questions can be authoritatively answered'
);

select is(
  (public.study_complete_session(
    (select id from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    2
  ) ->> 'questions_answered')::integer,
  4,
  'Study completion returns a truthful answered-question total excluding withdrawn content'
);

select is(
  (public.study_complete_session(
    (select id from public.sessions where start_operation_id = 'a6000000-0000-0000-0000-000000000101'::uuid),
    2
  ) ->> 'completion_percentage')::integer,
  100,
  'Completed Study session reports truthful completion percentage'
);

select * from finish();
rollback;
