begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

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
('a6000000-0000-0000-0000-000000000001','m6-modes@example.invalid','authenticated','authenticated');

update public.profiles
set programme_id = '10000000-0000-0000-0000-000000000001',
    expected_exam_date = current_date + 90,
    daily_study_minutes = 20,
    onboarding_status = 'completed',
    onboarding_current_step = 4,
    diagnostic_invitation_decision = 'skip'
where user_id = 'a6000000-0000-0000-0000-000000000001';

insert into public.bookmarks(user_id, question_id, is_bookmarked, operation_sequence)
values ('a6000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',true,1);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a6000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);

select is(
  jsonb_array_length(public.study_start_session(
    'topic',
    '20000000-0000-0000-0000-000000000002'::uuid,
    '30000000-0000-0000-0000-000000000003'::uuid,
    3,
    'a6000000-0000-0000-0000-000000000102'::uuid
  ) -> 'questions'),
  3,
  'Topic Practice creates an eligible topic-scoped Study package'
);

reset role;
select set_config('request.jwt.claims','{}', true);
update public.sessions set status = 'abandoned'
where start_operation_id = 'a6000000-0000-0000-0000-000000000102'::uuid;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a6000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
select is(
  jsonb_array_length(public.study_start_session(
    'subject',
    '20000000-0000-0000-0000-000000000001'::uuid,
    null,
    3,
    'a6000000-0000-0000-0000-000000000103'::uuid
  ) -> 'questions'),
  3,
  'Subject Practice creates an eligible subject-scoped Study package'
);

reset role;
select set_config('request.jwt.claims','{}', true);
update public.sessions set status = 'abandoned'
where start_operation_id = 'a6000000-0000-0000-0000-000000000103'::uuid;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a6000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
select is(
  jsonb_array_length(public.study_start_session(
    'bookmarks', null, null, 20,
    'a6000000-0000-0000-0000-000000000104'::uuid
  ) -> 'questions'),
  1,
  'Bookmark Practice uses only the student bookmarked eligible question'
);

reset role;
select set_config('request.jwt.claims','{}', true);
update public.sessions set status = 'abandoned'
where start_operation_id = 'a6000000-0000-0000-0000-000000000104'::uuid;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a6000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
select is(
  jsonb_array_length(public.study_start_session(
    'study_for_me', null, null, 6,
    'a6000000-0000-0000-0000-000000000105'::uuid
  ) -> 'questions'),
  6,
  'Study for me provides a non-adaptive balanced baseline package'
);

reset role;
select set_config('request.jwt.claims','{}', true);
update public.sessions set status = 'abandoned'
where start_operation_id = 'a6000000-0000-0000-0000-000000000105'::uuid;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a6000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
select is(
  jsonb_array_length(public.study_start_session(
    'quick', null, null, 20,
    'a6000000-0000-0000-0000-000000000106'::uuid
  ) -> 'questions'),
  20,
  'Quick Practice 20 uses the requested fixed question count'
);

reset role;
select set_config('request.jwt.claims','{}', true);
update public.sessions set status = 'abandoned'
where start_operation_id = 'a6000000-0000-0000-0000-000000000106'::uuid;
update private.question_source_governance
set rights_status = 'restricted'
where source_id = '40000000-0000-0000-0000-000000000001'::uuid;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a6000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
select is(
  pg_temp.capture_sqlstate($q$select public.study_start_session('study_for_me',null,null,5,'a6000000-0000-0000-0000-000000000107'::uuid)$q$),
  'P0002',
  'Current restricted rights state prevents question assignment to new Study sessions'
);

select * from finish();
rollback;
