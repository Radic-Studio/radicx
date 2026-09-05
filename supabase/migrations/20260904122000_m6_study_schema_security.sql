-- RadicX M6 Study Engine
-- Server-authoritative Study manifests, safe question delivery, secure answer evaluation,
-- bookmark/report mutation boundaries, and M6 stale-session protection.

alter table public.sessions
  add column study_kind text,
  add column study_subject_id uuid references public.subjects(id) on delete restrict,
  add column study_topic_id uuid references public.topics(id) on delete restrict,
  add column target_question_count smallint check (target_question_count is null or target_question_count between 1 and 20),
  add column current_position smallint check (current_position is null or current_position between 1 and 20),
  add column start_operation_id uuid;

alter table public.sessions
  add constraint sessions_study_kind_check
  check (study_kind is null or study_kind in ('study_for_me','subject','topic','quick','bookmarks')),
  add constraint sessions_study_subject_topic_check
  check (
    study_kind is null
    or (mode = 'study' and (
      (study_kind in ('study_for_me','quick','bookmarks') and study_subject_id is null and study_topic_id is null)
      or (study_kind = 'subject' and study_subject_id is not null and study_topic_id is null)
      or (study_kind = 'topic' and study_subject_id is not null and study_topic_id is not null)
    ))
  ),
  add constraint sessions_study_target_check
  check (
    study_kind is null
    or (study_kind = 'quick' and target_question_count in (5,10,20))
    or (study_kind <> 'quick' and target_question_count between 1 and 20)
  );

create unique index sessions_study_start_operation_uniq
  on public.sessions(user_id, start_operation_id)
  where start_operation_id is not null;

create index sessions_user_active_study_idx
  on public.sessions(user_id, last_activity_at desc)
  where mode = 'study' and status in ('created','active');

create unique index sessions_one_active_m6_study_per_user
  on public.sessions(user_id)
  where mode = 'study' and study_kind is not null and status in ('created','active');

create table public.study_session_items (
  session_id uuid not null,
  user_id uuid not null,
  position smallint not null check (position between 1 and 20),
  question_id uuid not null references public.questions(id) on delete restrict,
  revision_number integer not null check (revision_number > 0),
  item_state text not null default 'assigned' check (item_state in ('assigned','answered','withdrawn')),
  withdrawn_reason text,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  primary key(session_id, position),
  unique(session_id, question_id),
  foreign key(session_id, user_id) references public.sessions(id, user_id) on delete cascade,
  check ((item_state = 'answered' and answered_at is not null) or item_state <> 'answered'),
  check ((item_state = 'withdrawn' and withdrawn_reason is not null) or item_state <> 'withdrawn')
);

create index study_session_items_user_session_position_idx
  on public.study_session_items(user_id, session_id, position);
create index study_session_items_question_idx
  on public.study_session_items(question_id, session_id);

alter table public.study_session_items enable row level security;
revoke all on public.study_session_items from anon, authenticated;
grant select on public.study_session_items to authenticated;
grant all on public.study_session_items to service_role;

create policy study_session_items_select_own
on public.study_session_items for select to authenticated
using ((select auth.uid()) = user_id);

alter table public.session_answers
  add column is_correct boolean,
  add column evaluated_at timestamptz;

alter table public.session_answers
  add constraint session_answers_evaluation_pair_check
  check ((is_correct is null and evaluated_at is null) or (is_correct is not null and evaluated_at is not null));

alter table public.bookmarks
  add column is_bookmarked boolean not null default true,
  add column operation_id uuid,
  add column operation_sequence bigint not null default 0 check (operation_sequence >= 0),
  add column updated_at timestamptz not null default now();

create unique index bookmarks_user_operation_uniq
  on public.bookmarks(user_id, operation_id)
  where operation_id is not null;

-- M6 no longer allows browser code to retrieve arbitrary whole question rows.
-- Study question content is delivered only through the safe Study RPC contract below.
revoke select on public.questions from authenticated;

-- Final Study answers are authoritative RPC writes. Client-side option selection remains local.
revoke insert, update, delete on public.session_answers from authenticated;

-- Bookmark/report writes now cross M6 RPC boundaries so replay, manifest membership and
-- student-safe validation cannot be bypassed by direct browser mutations.
revoke insert, delete on public.bookmarks from authenticated;
revoke insert on public.question_reports from authenticated;

create or replace function private.require_m6_student()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception using errcode = '42501', message = 'authenticated student session required';
  end if;

  if not exists (
    select 1
    from public.profiles p
    join public.programmes programme on programme.id = p.programme_id and programme.is_active
    where p.user_id = actor
      and p.onboarding_status = 'completed'
  ) then
    raise exception using errcode = '55000', message = 'completed onboarding and an active programme are required';
  end if;

  return actor;
end;
$$;

create or replace function private.study_question_is_eligible(
  p_question_id uuid,
  p_programme_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.questions q
    join public.subjects s
      on s.id = q.subject_id
      and s.programme_id = p_programme_id
      and s.is_active
    join public.programmes p
      on p.id = s.programme_id
      and p.is_active
    left join public.topics t on t.id = q.topic_id
    join public.question_sources src on src.id = q.source_id
    join private.question_source_governance qsg on qsg.source_id = src.id
    join public.cognitive_levels cl on cl.code = q.cognitive_level and cl.is_active
    join public.clinical_tasks ct on ct.code = q.clinical_task and ct.is_active
    where q.id = p_question_id
      and q.status = 'published'
      and (q.topic_id is null or (t.is_active and t.subject_id = q.subject_id))
      and qsg.rights_status in ('owned','licensed','permission_confirmed','public_domain')
      and exists (
        select 1 from private.question_keys qk
        where qk.question_id = q.id
          and qk.correct_option >= 0
          and qk.correct_option < jsonb_array_length(q.options)
      )
  );
$$;

create or replace function private.study_advance_session(
  p_session_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_item record;
begin
  select i.position, i.question_id
  into next_item
  from public.study_session_items i
  join public.sessions s on s.id = i.session_id and s.user_id = i.user_id
  where i.session_id = p_session_id
    and i.user_id = p_user_id
    and i.item_state = 'assigned'
  order by i.position
  limit 1;

  if found then
    update public.sessions
    set current_position = next_item.position,
        current_question_id = next_item.question_id,
        last_activity_at = now(),
        updated_at = now()
    where id = p_session_id and user_id = p_user_id;
  else
    update public.sessions
    set current_question_id = null,
        current_position = null,
        last_activity_at = now(),
        updated_at = now()
    where id = p_session_id and user_id = p_user_id;
  end if;
end;
$$;

create or replace function private.study_withdraw_ineligible_items(
  p_session_id uuid,
  p_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  student_programme_id uuid;
  affected integer;
begin
  select p.programme_id into student_programme_id
  from public.profiles p
  where p.user_id = p_user_id;

  update public.study_session_items i
  set item_state = 'withdrawn',
      withdrawn_reason = 'question_unavailable'
  where i.session_id = p_session_id
    and i.user_id = p_user_id
    and i.item_state = 'assigned'
    and not private.study_question_is_eligible(i.question_id, student_programme_id);
  get diagnostics affected = row_count;

  if affected > 0 then
    perform private.study_advance_session(p_session_id, p_user_id);
  end if;

  return affected;
end;
$$;

create or replace function private.study_result_json(
  p_session_id uuid,
  p_question_id uuid,
  p_user_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'status', 'evaluated',
    'session_id', a.session_id,
    'question_id', a.question_id,
    'selected_option', a.selected_option,
    'confidence', a.confidence,
    'correct', a.is_correct,
    'correct_option', qk.correct_option,
    'explanation', qk.explanation_private,
    'evaluated_at', a.evaluated_at,
    'next_position', s.current_position,
    'complete_ready', not exists (
      select 1 from public.study_session_items pending
      where pending.session_id = a.session_id
        and pending.user_id = a.user_id
        and pending.item_state = 'assigned'
    )
  )
  from public.session_answers a
  join public.sessions s on s.id = a.session_id and s.user_id = a.user_id
  join private.question_keys qk on qk.question_id = a.question_id
  where a.session_id = p_session_id
    and a.question_id = p_question_id
    and a.user_id = p_user_id
    and a.is_correct is not null;
$$;
