begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

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

create function pg_temp.exec_rowcount(statement text)
returns bigint
language plpgsql
as $$
declare
  affected bigint;
begin
  execute statement;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='programme_id'), 'profiles.programme_id exists');
select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='expected_exam_date'), 'profiles.expected_exam_date exists');
select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='daily_study_minutes'), 'profiles.daily_study_minutes exists');
select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='onboarding_status'), 'profiles.onboarding_status exists');
select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='onboarding_current_step'), 'profiles.onboarding_current_step exists');
select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='onboarding_version'), 'profiles.onboarding_version exists');
select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='onboarding_completed_at'), 'profiles.onboarding_completed_at exists');
select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='diagnostic_invitation_decision'), 'profiles.diagnostic_invitation_decision exists');
select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='diagnostic_invitation_decided_at'), 'profiles.diagnostic_invitation_decided_at exists');
select ok(exists(select 1 from pg_constraint where conrelid='public.profiles'::regclass and contype='f' and conname='profiles_programme_id_fkey'), 'programme foreign key exists');
select ok(to_regclass('public.profiles_programme_idx') is not null, 'programme foreign-key index exists');

insert into auth.users(id, email, aud, role) values
('c1000000-0000-0000-0000-000000000001','m5-a@example.invalid','authenticated','authenticated'),
('c1000000-0000-0000-0000-000000000002','m5-b@example.invalid','authenticated','authenticated');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);

select is((select count(*) from public.profiles), 1::bigint, 'Student A sees only Student A profile');
select is(pg_temp.exec_rowcount($q$update public.profiles set programme_id='10000000-0000-0000-0000-000000000001', onboarding_status='in_progress', onboarding_current_step=2 where user_id='c1000000-0000-0000-0000-000000000001'$q$), 1::bigint, 'Student A can save programme and advance');
select is(pg_temp.capture_sqlstate($q$update public.profiles set daily_study_minutes=25 where user_id='c1000000-0000-0000-0000-000000000001'$q$), '23514', 'invalid daily study preference is rejected');
select is(pg_temp.capture_sqlstate($q$update public.profiles set onboarding_current_step=3 where user_id='c1000000-0000-0000-0000-000000000001'$q$), '23514', 'onboarding cannot advance without exam date');
select is(pg_temp.exec_rowcount($q$update public.profiles set expected_exam_date='2026-12-15', onboarding_current_step=3 where user_id='c1000000-0000-0000-0000-000000000001'$q$), 1::bigint, 'Student A can save exam date and advance');
select is(pg_temp.exec_rowcount($q$update public.profiles set daily_study_minutes=30, onboarding_current_step=4 where user_id='c1000000-0000-0000-0000-000000000001'$q$), 1::bigint, 'Student A can save study preference and advance');
select is(pg_temp.capture_sqlstate($q$update public.profiles set onboarding_status='completed' where user_id='c1000000-0000-0000-0000-000000000001'$q$), '23514', 'completion without diagnostic decision is rejected');
select lives_ok($q$update public.profiles set diagnostic_invitation_decision='start', onboarding_status='completed' where user_id='c1000000-0000-0000-0000-000000000001'$q$, 'valid onboarding completion succeeds');
select ok((select onboarding_status='completed' and onboarding_completed_at is not null and diagnostic_invitation_decided_at is not null from public.profiles where user_id='c1000000-0000-0000-0000-000000000001'), 'completion and diagnostic timestamps are server populated');
select is(pg_temp.exec_rowcount($q$update public.profiles set display_name='Nope' where user_id='c1000000-0000-0000-0000-000000000002'$q$), 0::bigint, 'Student A cannot update Student B profile');
select is(pg_temp.capture_sqlstate($q$update public.profiles set user_id='c1000000-0000-0000-0000-000000000002' where user_id='c1000000-0000-0000-0000-000000000001'$q$), '42501', 'Student cannot update protected profile identity');

reset role;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select is(pg_temp.capture_sqlstate('select * from public.profiles'), '42501', 'Anonymous profile access remains denied');

select * from finish();
rollback;
