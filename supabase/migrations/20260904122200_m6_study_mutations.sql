create or replace function public.study_submit_answer(
  p_session_id uuid,
  p_question_id uuid,
  p_selected_option integer,
  p_confidence integer,
  p_operation_id uuid,
  p_device_version integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid;
  student_programme_id uuid;
  session_row public.sessions%rowtype;
  item_row public.study_session_items%rowtype;
  existing_answer public.session_answers%rowtype;
  option_count integer;
  correct_option integer;
  derived_correct boolean;
begin
  actor := private.require_m6_student();
  if p_operation_id is null then
    raise exception using errcode = '22023', message = 'answer operation ID is required';
  end if;

  select * into existing_answer
  from public.session_answers a
  where a.operation_id = p_operation_id;

  if found then
    if existing_answer.user_id <> actor
       or existing_answer.session_id <> p_session_id
       or existing_answer.question_id <> p_question_id then
      raise exception using errcode = '23505', message = 'answer operation ID is already in use';
    end if;
    return private.study_result_json(p_session_id, p_question_id, actor);
  end if;

  select * into session_row
  from public.sessions s
  where s.id = p_session_id
    and s.user_id = actor
    and s.mode = 'study'
    and s.study_kind is not null
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'study session is unavailable';
  end if;
  if session_row.status <> 'active' then
    raise exception using errcode = '55000', message = 'study session is not active';
  end if;
  if p_device_version <> session_row.device_version then
    raise exception using errcode = '40001', message = 'study session is active on a newer device version';
  end if;

  select * into item_row
  from public.study_session_items i
  where i.session_id = session_row.id
    and i.user_id = actor
    and i.question_id = p_question_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'question does not belong to this Study session';
  end if;

  if item_row.position <> session_row.current_position then
    raise exception using errcode = '55000', message = 'answer does not match the current Study position';
  end if;

  if item_row.item_state <> 'assigned' then
    if item_row.item_state = 'answered' then
      raise exception using errcode = '23505', message = 'this Study answer is already final';
    end if;
    return jsonb_build_object(
      'status', 'question_unavailable',
      'session_id', session_row.id,
      'question_id', p_question_id,
      'next_position', session_row.current_position
    );
  end if;

  select p.programme_id into student_programme_id from public.profiles p where p.user_id = actor;
  if not private.study_question_is_eligible(p_question_id, student_programme_id) then
    update public.study_session_items
    set item_state = 'withdrawn', withdrawn_reason = 'question_unavailable'
    where session_id = session_row.id and position = item_row.position;
    perform private.study_advance_session(session_row.id, actor);
    return jsonb_build_object(
      'status', 'question_unavailable',
      'session_id', session_row.id,
      'question_id', p_question_id,
      'next_position', (select current_position from public.sessions where id = session_row.id)
    );
  end if;

  select jsonb_array_length(q.options), qk.correct_option
  into option_count, correct_option
  from public.questions q
  join private.question_keys qk on qk.question_id = q.id
  where q.id = p_question_id
    and q.revision_number = item_row.revision_number;

  if option_count is null then
    raise exception using errcode = '55000', message = 'assigned question revision is unavailable';
  end if;
  if p_selected_option < 0 or p_selected_option >= option_count then
    raise exception using errcode = '22023', message = 'selected option is invalid';
  end if;
  if p_confidence not in (1,3,5) then
    raise exception using errcode = '22023', message = 'confidence must be Guessing, Unsure or Confident';
  end if;

  if exists (
    select 1 from public.session_answers a
    where a.session_id = session_row.id and a.question_id = p_question_id
  ) then
    raise exception using errcode = '23505', message = 'this Study answer is already final';
  end if;

  derived_correct := p_selected_option = correct_option;

  insert into public.session_answers(
    session_id, user_id, question_id, selected_option, confidence,
    flagged, operation_id, answered_at, is_correct, evaluated_at
  ) values (
    session_row.id, actor, p_question_id, p_selected_option, p_confidence,
    false, p_operation_id, now(), derived_correct, now()
  );

  update public.study_session_items
  set item_state = 'answered', answered_at = now()
  where session_id = session_row.id and position = item_row.position;

  perform private.study_advance_session(session_row.id, actor);

  return private.study_result_json(session_row.id, p_question_id, actor);
end;
$$;

create or replace function public.study_set_bookmark(
  p_session_id uuid,
  p_question_id uuid,
  p_is_bookmarked boolean,
  p_operation_id uuid,
  p_operation_sequence bigint,
  p_device_version integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid;
  session_version integer;
  current_row public.bookmarks%rowtype;
begin
  actor := private.require_m6_student();
  if p_operation_id is null or p_operation_sequence < 1 then
    raise exception using errcode = '22023', message = 'bookmark operation metadata is required';
  end if;

  select s.device_version into session_version
  from public.sessions s
  where s.id = p_session_id
    and s.user_id = actor
    and s.mode = 'study'
    and s.study_kind is not null
    and s.status = 'active';

  if session_version is null then
    raise exception using errcode = 'P0002', message = 'study session is unavailable';
  end if;
  if session_version <> p_device_version then
    raise exception using errcode = '40001', message = 'study session is active on a newer device version';
  end if;
  if not exists (
    select 1 from public.study_session_items i
    where i.session_id = p_session_id and i.user_id = actor and i.question_id = p_question_id
  ) then
    raise exception using errcode = '42501', message = 'question does not belong to this Study session';
  end if;

  select * into current_row
  from public.bookmarks b
  where b.user_id = actor and b.question_id = p_question_id
  for update;

  if found and current_row.operation_id = p_operation_id then
    return jsonb_build_object('question_id', p_question_id, 'bookmarked', current_row.is_bookmarked, 'applied', true);
  end if;

  if found and current_row.operation_sequence >= p_operation_sequence then
    return jsonb_build_object('question_id', p_question_id, 'bookmarked', current_row.is_bookmarked, 'applied', false);
  end if;

  insert into public.bookmarks(user_id, question_id, is_bookmarked, operation_id, operation_sequence, updated_at)
  values (actor, p_question_id, p_is_bookmarked, p_operation_id, p_operation_sequence, now())
  on conflict (user_id, question_id) do update
    set is_bookmarked = excluded.is_bookmarked,
        operation_id = excluded.operation_id,
        operation_sequence = excluded.operation_sequence,
        updated_at = now();

  return jsonb_build_object('question_id', p_question_id, 'bookmarked', p_is_bookmarked, 'applied', true);
end;
$$;

create or replace function public.study_report_question(
  p_session_id uuid,
  p_question_id uuid,
  p_category text,
  p_details text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid;
  existing_id uuid;
  report_id uuid;
begin
  actor := private.require_m6_student();
  if p_category not in ('incorrect','ambiguous','outdated','typo','other') then
    raise exception using errcode = '22023', message = 'unsupported report category';
  end if;
  if p_details is not null and char_length(p_details) > 2000 then
    raise exception using errcode = '22023', message = 'report details are too long';
  end if;
  if not exists (
    select 1 from public.study_session_items i
    where i.session_id = p_session_id and i.user_id = actor and i.question_id = p_question_id
  ) then
    raise exception using errcode = '42501', message = 'question does not belong to this Study session';
  end if;

  select r.id into existing_id
  from public.question_reports r
  where r.user_id = actor
    and r.question_id = p_question_id
    and r.category = p_category
    and r.status = 'open'
    and r.created_at >= now() - interval '24 hours'
  order by r.created_at desc
  limit 1;

  if found then
    return existing_id;
  end if;

  insert into public.question_reports(user_id, question_id, category, details, status)
  values (actor, p_question_id, p_category, nullif(trim(p_details), ''), 'open')
  returning id into report_id;

  return report_id;
end;
$$;

create or replace function public.study_complete_session(
  p_session_id uuid,
  p_device_version integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid;
  session_row public.sessions%rowtype;
  answered_count integer;
  correct_count integer;
  incorrect_count integer;
  withdrawn_count integer;
  effective_total integer;
  duration_seconds integer;
begin
  actor := private.require_m6_student();

  select * into session_row
  from public.sessions s
  where s.id = p_session_id
    and s.user_id = actor
    and s.mode = 'study'
    and s.study_kind is not null
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'study session is unavailable';
  end if;
  if session_row.status = 'submitted' then
    select count(*), count(*) filter (where a.is_correct), count(*) filter (where not a.is_correct)
    into answered_count, correct_count, incorrect_count
    from public.session_answers a
    where a.session_id = session_row.id and a.user_id = actor and a.is_correct is not null;

    select count(*) into withdrawn_count from public.study_session_items i
    where i.session_id = session_row.id and i.user_id = actor and i.item_state = 'withdrawn';
    effective_total := greatest(answered_count, coalesce(session_row.target_question_count, answered_count) - withdrawn_count);
    duration_seconds := greatest(0, extract(epoch from (coalesce(session_row.submitted_at, now()) - session_row.started_at))::integer);

    return jsonb_build_object(
      'session_id', session_row.id,
      'questions_answered', answered_count,
      'correct', correct_count,
      'incorrect', incorrect_count,
      'completion_percentage', case when effective_total = 0 then 100 else round(answered_count * 100.0 / effective_total) end,
      'duration_seconds', duration_seconds
    );
  end if;

  if session_row.status <> 'active' then
    raise exception using errcode = '55000', message = 'study session is not active';
  end if;
  if session_row.device_version <> p_device_version then
    raise exception using errcode = '40001', message = 'study session is active on a newer device version';
  end if;

  perform private.study_withdraw_ineligible_items(session_row.id, actor);

  if exists (
    select 1 from public.study_session_items i
    where i.session_id = session_row.id and i.user_id = actor and i.item_state = 'assigned'
  ) then
    raise exception using errcode = '55000', message = 'study answers still need to be checked before completion';
  end if;

  update public.sessions
  set status = 'submitted', submitted_at = now(), current_question_id = null,
      last_activity_at = now(), updated_at = now()
  where id = session_row.id
  returning * into session_row;

  select count(*), count(*) filter (where a.is_correct), count(*) filter (where not a.is_correct)
  into answered_count, correct_count, incorrect_count
  from public.session_answers a
  where a.session_id = session_row.id and a.user_id = actor and a.is_correct is not null;

  select count(*) into withdrawn_count from public.study_session_items i
  where i.session_id = session_row.id and i.user_id = actor and i.item_state = 'withdrawn';

  effective_total := greatest(answered_count, coalesce(session_row.target_question_count, answered_count) - withdrawn_count);
  duration_seconds := greatest(0, extract(epoch from (session_row.submitted_at - session_row.started_at))::integer);

  return jsonb_build_object(
    'session_id', session_row.id,
    'questions_answered', answered_count,
    'correct', correct_count,
    'incorrect', incorrect_count,
    'completion_percentage', case when effective_total = 0 then 100 else round(answered_count * 100.0 / effective_total) end,
    'duration_seconds', duration_seconds
  );
end;
$$;

-- Reject browser-authenticated direct mutation of M6-owned Study sessions while preserving
-- the accepted pre-M6 table/RLS contract for legacy session rows. SECURITY DEFINER Study RPCs
-- execute as the function owner and are not blocked by this guard.
create or replace function private.protect_m6_study_session_direct_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') in ('authenticated','anon') and old.study_kind is not null then
    raise exception using errcode = '42501', message = 'M6 Study sessions are server-authoritative';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger protect_m6_study_session_direct_mutation
before update or delete on public.sessions
for each row execute function private.protect_m6_study_session_direct_mutation();

revoke execute on function private.require_m6_student() from public, anon, authenticated;
revoke execute on function private.study_question_is_eligible(uuid, uuid) from public, anon, authenticated;
revoke execute on function private.study_advance_session(uuid, uuid) from public, anon, authenticated;
revoke execute on function private.study_withdraw_ineligible_items(uuid, uuid) from public, anon, authenticated;
revoke execute on function private.study_result_json(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function private.protect_m6_study_session_direct_mutation() from public, anon, authenticated;

grant execute on function private.require_m6_student() to service_role;
grant execute on function private.study_question_is_eligible(uuid, uuid) to service_role;
grant execute on function private.study_advance_session(uuid, uuid) to service_role;
grant execute on function private.study_withdraw_ineligible_items(uuid, uuid) to service_role;
grant execute on function private.study_result_json(uuid, uuid, uuid) to service_role;

grant execute on function public.study_active_session() to authenticated;
grant execute on function public.study_resume_session(uuid, integer) to authenticated;
grant execute on function public.study_start_session(text, uuid, uuid, integer, uuid) to authenticated;
grant execute on function public.study_submit_answer(uuid, uuid, integer, integer, uuid, integer) to authenticated;
grant execute on function public.study_set_bookmark(uuid, uuid, boolean, uuid, bigint, integer) to authenticated;
grant execute on function public.study_report_question(uuid, uuid, text, text) to authenticated;
grant execute on function public.study_complete_session(uuid, integer) to authenticated;

revoke execute on function public.study_active_session() from public, anon;
revoke execute on function public.study_resume_session(uuid, integer) from public, anon;
revoke execute on function public.study_start_session(text, uuid, uuid, integer, uuid) from public, anon;
revoke execute on function public.study_submit_answer(uuid, uuid, integer, integer, uuid, integer) from public, anon;
revoke execute on function public.study_set_bookmark(uuid, uuid, boolean, uuid, bigint, integer) from public, anon;
revoke execute on function public.study_report_question(uuid, uuid, text, text) from public, anon;
revoke execute on function public.study_complete_session(uuid, integer) from public, anon;
