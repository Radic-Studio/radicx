-- M6 correction: the direct-mutation guard must distinguish browser DML from
-- trusted SECURITY DEFINER Study RPC writes. auth.jwt() continues to expose the
-- student's JWT inside a SECURITY DEFINER RPC, so checking JWT role inside a
-- SECURITY DEFINER trigger incorrectly blocks the trusted RPC itself.
--
-- Run this trigger as SECURITY INVOKER and key the guard to current_user:
-- direct PostgREST DML runs as authenticated/anon, while Study RPC-owned writes
-- run with the trusted function owner's database role.
create or replace function private.protect_m6_study_session_direct_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('authenticated','anon') and old.study_kind is not null then
    raise exception using errcode = '42501', message = 'M6 Study sessions are server-authoritative';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke execute on function private.protect_m6_study_session_direct_mutation() from public, anon, authenticated;
