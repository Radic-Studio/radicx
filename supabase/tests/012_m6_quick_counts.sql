begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users(id, email, aud, role) values
('a6000000-0000-0000-0000-000000000010','m6-quick-counts@example.invalid','authenticated','authenticated');

update public.profiles
set programme_id = '10000000-0000-0000-0000-000000000001',
    expected_exam_date = current_date + 90,
    daily_study_minutes = 20,
    onboarding_status = 'completed',
    onboarding_current_step = 4,
    diagnostic_invitation_decision = 'skip'
where user_id = 'a6000000-0000-0000-0000-000000000010';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a6000000-0000-0000-0000-000000000010","role":"authenticated","aal":"aal1"}', true);

select is(
  jsonb_array_length(public.study_start_session(
    'quick', null, null, 5,
    'a6000000-0000-0000-0000-000000000205'::uuid
  ) -> 'questions'),
  5,
  'Quick Practice 5 assigns exactly five eligible questions'
);

reset role;
select set_config('request.jwt.claims','{}', true);
update public.sessions set status = 'abandoned'
where start_operation_id = 'a6000000-0000-0000-0000-000000000205'::uuid;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a6000000-0000-0000-0000-000000000010","role":"authenticated","aal":"aal1"}', true);
select is(
  jsonb_array_length(public.study_start_session(
    'quick', null, null, 10,
    'a6000000-0000-0000-0000-000000000210'::uuid
  ) -> 'questions'),
  10,
  'Quick Practice 10 assigns exactly ten eligible questions'
);

reset role;
select set_config('request.jwt.claims','{}', true);
update public.sessions set status = 'abandoned'
where start_operation_id = 'a6000000-0000-0000-0000-000000000210'::uuid;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a6000000-0000-0000-0000-000000000010","role":"authenticated","aal":"aal1"}', true);
select is(
  jsonb_array_length(public.study_start_session(
    'quick', null, null, 20,
    'a6000000-0000-0000-0000-000000000220'::uuid
  ) -> 'questions'),
  20,
  'Quick Practice 20 assigns exactly twenty eligible questions'
);

select * from finish();
rollback;
