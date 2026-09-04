begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select ok(to_regnamespace('private') is not null, 'private schema exists');
select ok(to_regclass('public.profiles') is not null, 'profiles exists');
select ok(to_regclass('public.programmes') is not null, 'programmes exists');
select ok(to_regclass('public.subjects') is not null, 'subjects exists');
select ok(to_regclass('public.topics') is not null, 'topics exists');
select ok(to_regclass('public.questions') is not null, 'questions exists');
select ok(to_regclass('private.question_keys') is not null, 'private question keys exist');
select ok(to_regclass('private.staff_roles') is not null, 'private staff roles exist');
select ok(to_regclass('public.sessions') is not null, 'sessions exists');
select ok(to_regclass('public.session_answers') is not null, 'session answers exist');
select ok((select relrowsecurity from pg_class where oid='public.sessions'::regclass), 'sessions RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.bookmarks'::regclass), 'bookmarks RLS enabled');
select throws_ok(
  $$insert into private.question_keys(question_id, correct_option) values ('50000000-0000-0000-0000-000000000001', 9)$$,
  'P0001',
  'correct_option must reference an existing question option',
  'question key option must exist'
);

select * from finish();
rollback;
