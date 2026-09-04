begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

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
('d0000000-0000-0000-0000-000000000001','m5-security-admin@example.invalid','authenticated','authenticated'),
('d0000000-0000-0000-0000-000000000002','m5-security-student@example.invalid','authenticated','authenticated');

insert into private.staff_roles(user_id, role, granted_by)
values (
  'd0000000-0000-0000-0000-000000000001',
  'content_admin',
  'd0000000-0000-0000-0000-000000000001'
);

select is(
  (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'admin\_%' escape '\'
      and (
        not p.prosecdef
        or position('private.require_staff' in pg_get_functiondef(p.oid)) = 0
        or p.proconfig is null
        or not (p.proconfig @> array['search_path=""']::text[])
      )
  ),
  0::bigint,
  'every M4 admin RPC remains a fixed-search-path security-definer wrapper around private.require_staff'
);

select ok(
  (
    select p.prosecdef
      and p.proconfig @> array['search_path=""']::text[]
      and not has_function_privilege('authenticated', p.oid, 'execute')
      and not has_function_privilege('anon', p.oid, 'execute')
      and position('aal2' in pg_get_functiondef(p.oid)) > 0
      and position('private.staff_roles' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'require_staff'
  ),
  'private.require_staff is not browser-callable and enforces AAL2 plus private staff roles'
);

select is(
  (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'admin\_%' escape '\'
      and (
        has_function_privilege('anon', p.oid, 'execute')
        or not has_function_privilege('authenticated', p.oid, 'execute')
      )
  ),
  0::bigint,
  'M4 admin RPCs are callable only through authenticated browser sessions, never anon'
);

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"d0000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2","user_metadata":{"role":"content_admin"}}',
  true
);

select is(
  (
    select count(*)
    from unnest(array[
      $q$select public.admin_create_import_batch(null, 'fixture.csv', repeat('a', 64), '{}'::jsonb)$q$,
      $q$select public.admin_create_question('00000000-0000-0000-0000-000000000001'::uuid, null, '00000000-0000-0000-0000-000000000002'::uuid, 'fixture', '["A","B"]'::jsonb, 'application', 'development_fixture', 'standard'::public.question_risk_tier, 0, null)$q$,
      $q$select public.admin_create_question_revision('00000000-0000-0000-0000-000000000003'::uuid)$q$,
      $q$select public.admin_create_source('radicx_original', 'fixture', null, null, 'pending', null, null, null)$q$,
      $q$select * from public.admin_list_questions(null::public.question_status, 1)$q$,
      $q$select public.admin_promote_import_row_to_draft('00000000-0000-0000-0000-000000000004'::uuid)$q$,
      $q$select public.admin_publish_question('00000000-0000-0000-0000-000000000005'::uuid)$q$,
      $q$select public.admin_quarantine_question('00000000-0000-0000-0000-000000000006'::uuid, 'fixture')$q$,
      $q$select public.admin_question_gate_status('00000000-0000-0000-0000-000000000007'::uuid)$q$,
      $q$select public.admin_record_question_review('00000000-0000-0000-0000-000000000008'::uuid, 'rights', 'approved', null, false)$q$,
      $q$select public.admin_set_question_key('00000000-0000-0000-0000-000000000009'::uuid, 0, null)$q$,
      $q$select public.admin_stage_import_row('00000000-0000-0000-0000-000000000010'::uuid, 1, '{}'::jsonb)$q$,
      $q$select public.admin_submit_question_for_review('00000000-0000-0000-0000-000000000011'::uuid)$q$,
      $q$select public.admin_upsert_taxonomy_term('cognitive_level', 'fixture', 'Fixture', null, 0)$q$
    ]) as calls(statement)
    where pg_temp.capture_sqlstate(statement) is distinct from '42501'
  ),
  0::bigint,
  'every M4 admin RPC rejects an AAL2 authenticated non-staff user even with forged metadata'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

select is(
  (
    select count(*)
    from unnest(array[
      $q$select public.admin_create_import_batch(null, 'fixture.csv', repeat('a', 64), '{}'::jsonb)$q$,
      $q$select public.admin_create_question('00000000-0000-0000-0000-000000000001'::uuid, null, '00000000-0000-0000-0000-000000000002'::uuid, 'fixture', '["A","B"]'::jsonb, 'application', 'development_fixture', 'standard'::public.question_risk_tier, 0, null)$q$,
      $q$select public.admin_create_question_revision('00000000-0000-0000-0000-000000000003'::uuid)$q$,
      $q$select public.admin_create_source('radicx_original', 'fixture', null, null, 'pending', null, null, null)$q$,
      $q$select * from public.admin_list_questions(null::public.question_status, 1)$q$,
      $q$select public.admin_promote_import_row_to_draft('00000000-0000-0000-0000-000000000004'::uuid)$q$,
      $q$select public.admin_publish_question('00000000-0000-0000-0000-000000000005'::uuid)$q$,
      $q$select public.admin_quarantine_question('00000000-0000-0000-0000-000000000006'::uuid, 'fixture')$q$,
      $q$select public.admin_question_gate_status('00000000-0000-0000-0000-000000000007'::uuid)$q$,
      $q$select public.admin_record_question_review('00000000-0000-0000-0000-000000000008'::uuid, 'rights', 'approved', null, false)$q$,
      $q$select public.admin_set_question_key('00000000-0000-0000-0000-000000000009'::uuid, 0, null)$q$,
      $q$select public.admin_stage_import_row('00000000-0000-0000-0000-000000000010'::uuid, 1, '{}'::jsonb)$q$,
      $q$select public.admin_submit_question_for_review('00000000-0000-0000-0000-000000000011'::uuid)$q$,
      $q$select public.admin_upsert_taxonomy_term('cognitive_level', 'fixture', 'Fixture', null, 0)$q$
    ]) as calls(statement)
    where pg_temp.capture_sqlstate(statement) is distinct from '42501'
  ),
  0::bigint,
  'every M4 admin RPC rejects an AAL1 staff session'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d0000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2","user_metadata":{"role":"content_admin"}}',
  true
);
select ok(
  not public.is_content_staff() and not public.is_content_admin(),
  'content helper RPCs ignore forged metadata and deny non-staff users'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);
select ok(
  not public.is_content_staff() and not public.is_content_admin(),
  'content helper RPCs deny AAL1 staff sessions'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
select ok(
  public.is_content_staff() and public.is_content_admin(),
  'content helper RPCs recognize an AAL2 content admin from private.staff_roles'
);

select * from finish();
rollback;
