begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

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
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','student-a@example.invalid','authenticated','authenticated'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','student-b@example.invalid','authenticated','authenticated');

insert into public.sessions(id, user_id, mode, status) values
('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','study','created'),
('bbbbbbbb-0000-0000-0000-000000000001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','study','created');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","aal":"aal1","user_metadata":{"role":"super_admin"}}', true);

select is((select count(*) from public.sessions), 1::bigint, 'Student A sees only Student A sessions');
select is((select count(*) from public.profiles), 1::bigint, 'Student A sees only Student A profile');
select is((with changed as (update public.sessions set status='active' where user_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' returning 1) select count(*) from changed), 0::bigint, 'Student A cannot update Student B session');
select is(pg_temp.capture_sqlstate('select * from private.question_keys'), '42501', 'Student cannot read private answer keys');
select is(pg_temp.capture_sqlstate($q$insert into private.staff_roles(user_id, role) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','super_admin')$q$), '42501', 'Student cannot self-assign staff role even with forged user metadata');
select is(pg_temp.capture_sqlstate($q$update public.profiles set created_at = now() where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$), '42501', 'Student cannot update protected profile columns');

reset role;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}', true);
select is(pg_temp.capture_sqlstate('select * from public.profiles'), '42501', 'Anonymous user cannot retrieve profiles');

reset role;
select lives_ok($$insert into public.session_answers(session_id,user_id,question_id,selected_option) values ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','50000000-0000-0000-0000-000000000001',0)$$, 'first session answer is accepted');
select is(pg_temp.capture_sqlstate($q$insert into public.session_answers(session_id,user_id,question_id,selected_option) values ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','50000000-0000-0000-0000-000000000001',1)$q$), '23505', 'one answer per session/question is enforced');

select * from finish();
rollback;
