begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select is(
  (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'admin\_%' escape '\'
      and has_function_privilege('anon', p.oid, 'execute')
  ),
  0::bigint,
  'anonymous role cannot execute M4 admin RPCs'
);

select ok(
  not has_function_privilege('anon', 'public.is_content_staff()'::regprocedure, 'execute')
  and not has_function_privilege('anon', 'public.is_content_admin()'::regprocedure, 'execute'),
  'anonymous role cannot execute M4 content authorization helpers'
);

select is(
  (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'admin\_%' escape '\'
      and not has_function_privilege('authenticated', p.oid, 'execute')
  ),
  0::bigint,
  'authenticated role retains explicit execute grants for M4 admin RPCs'
);

select ok(
  position('correct_option' in pg_get_function_result('public.admin_list_questions(public.question_status,integer)'::regprocedure)) = 0
  and position('explanation_private' in pg_get_function_result('public.admin_list_questions(public.question_status,integer)'::regprocedure)) = 0,
  'admin question listing does not expose stored answer keys or private explanations'
);

select * from finish();
rollback;
