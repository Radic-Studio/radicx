alter table public.profiles enable row level security;
alter table public.programmes enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.question_sources enable row level security;
alter table public.questions enable row level security;
alter table public.sessions enable row level security;
alter table public.session_answers enable row level security;
alter table public.user_progress enable row level security;
alter table public.user_question_state enable row level security;
alter table public.user_subject_stats enable row level security;
alter table public.user_topic_stats enable row level security;
alter table public.bookmarks enable row level security;
alter table public.question_reports enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.programmes, public.subjects, public.topics to authenticated;
grant select on public.questions to authenticated;
grant select, insert, update, delete on public.sessions, public.session_answers, public.bookmarks to authenticated;
grant select on public.user_progress, public.user_question_state, public.user_subject_stats, public.user_topic_stats to authenticated;
grant select, insert on public.question_reports to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy programmes_read_authenticated on public.programmes for select to authenticated using (is_active);
create policy subjects_read_authenticated on public.subjects for select to authenticated using (is_active);
create policy topics_read_authenticated on public.topics for select to authenticated using (is_active);
create policy questions_read_published on public.questions for select to authenticated using (status = 'published');

create policy sessions_select_own on public.sessions for select to authenticated using ((select auth.uid()) = user_id);
create policy sessions_insert_own on public.sessions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy sessions_update_own on public.sessions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy sessions_delete_own on public.sessions for delete to authenticated using ((select auth.uid()) = user_id);

create policy session_answers_select_own on public.session_answers for select to authenticated using ((select auth.uid()) = user_id);
create policy session_answers_insert_own on public.session_answers for insert to authenticated with check ((select auth.uid()) = user_id);
create policy session_answers_update_own on public.session_answers for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy session_answers_delete_own on public.session_answers for delete to authenticated using ((select auth.uid()) = user_id);

create policy user_progress_select_own on public.user_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy user_question_state_select_own on public.user_question_state for select to authenticated using ((select auth.uid()) = user_id);
create policy user_subject_stats_select_own on public.user_subject_stats for select to authenticated using ((select auth.uid()) = user_id);
create policy user_topic_stats_select_own on public.user_topic_stats for select to authenticated using ((select auth.uid()) = user_id);

create policy bookmarks_select_own on public.bookmarks for select to authenticated using ((select auth.uid()) = user_id);
create policy bookmarks_insert_own on public.bookmarks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy bookmarks_delete_own on public.bookmarks for delete to authenticated using ((select auth.uid()) = user_id);

create policy question_reports_select_own on public.question_reports for select to authenticated using ((select auth.uid()) = user_id);
create policy question_reports_insert_own on public.question_reports for insert to authenticated with check ((select auth.uid()) = user_id and status = 'open');

revoke all on all tables in schema private from public, anon, authenticated;
grant all on all tables in schema private to service_role;

alter default privileges for role postgres in schema private revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema private revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema private revoke execute on functions from public, anon, authenticated;

create or replace function private.has_staff_role(required_role private.staff_role, require_aal2 boolean default true)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (not require_aal2 or coalesce(auth.jwt() ->> 'aal', '') = 'aal2')
    and exists (
      select 1 from private.staff_roles sr
      where sr.user_id = auth.uid() and sr.role = required_role
    );
$$;
revoke execute on function private.has_staff_role(private.staff_role, boolean) from public, anon, authenticated;
grant execute on function private.has_staff_role(private.staff_role, boolean) to service_role;
