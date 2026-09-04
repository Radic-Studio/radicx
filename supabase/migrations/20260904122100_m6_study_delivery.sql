create or replace function public.study_active_session()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid;
  session_row public.sessions%rowtype;
begin
  actor := private.require_m6_student();

  select * into session_row
  from public.sessions s
  where s.user_id = actor
    and s.mode = 'study'
    and s.study_kind is not null
    and s.status in ('created','active')
  order by s.last_activity_at desc
  limit 1;

  if not found then
    return null;
  end if;

  perform private.study_withdraw_ineligible_items(session_row.id, actor);

  select * into session_row from public.sessions where id = session_row.id;

  return jsonb_build_object(
    'session_id', session_row.id,
    'study_kind', session_row.study_kind,
    'subject_id', session_row.study_subject_id,
    'topic_id', session_row.study_topic_id,
    'target_question_count', session_row.target_question_count,
    'current_position', session_row.current_position,
    'device_version', session_row.device_version,
    'started_at', session_row.started_at,
    'last_activity_at', session_row.last_activity_at
  );
end;
$$;

create or replace function public.study_resume_session(
  p_session_id uuid,
  p_known_device_version integer default null
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
  package jsonb;
begin
  actor := private.require_m6_student();
  select p.programme_id into student_programme_id from public.profiles p where p.user_id = actor;

  select * into session_row
  from public.sessions s
  where s.id = p_session_id
    and s.user_id = actor
    and s.mode = 'study'
    and s.study_kind is not null
    and s.status in ('created','active')
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'study session is unavailable';
  end if;

  if p_known_device_version is null then
    update public.sessions
    set device_version = device_version + 1,
        last_activity_at = now(),
        updated_at = now()
    where id = session_row.id
    returning * into session_row;
  elsif p_known_device_version <> session_row.device_version then
    raise exception using errcode = '40001', message = 'study session is active on a newer device version';
  end if;

  perform private.study_withdraw_ineligible_items(session_row.id, actor);
  select * into session_row from public.sessions where id = session_row.id;

  select coalesce(jsonb_agg(item_json order by (item_json ->> 'position')::integer), '[]'::jsonb)
  into package
  from (
    select jsonb_build_object(
      'position', i.position,
      'question_id', i.question_id,
      'revision_id', i.question_id,
      'revision_number', i.revision_number,
      'state', i.item_state,
      'available', private.study_question_is_eligible(i.question_id, student_programme_id),
      'stem', case when private.study_question_is_eligible(i.question_id, student_programme_id) then q.stem else null end,
      'options', case when private.study_question_is_eligible(i.question_id, student_programme_id) then q.options else null end,
      'subject_id', q.subject_id,
      'subject_name', s.name,
      'topic_id', q.topic_id,
      'topic_name', t.name,
      'bookmarked', coalesce(b.is_bookmarked, false),
      'answer', case when a.is_correct is not null then jsonb_build_object(
        'selected_option', a.selected_option,
        'confidence', a.confidence,
        'correct', a.is_correct,
        'correct_option', qk.correct_option,
        'explanation', qk.explanation_private,
        'evaluated_at', a.evaluated_at
      ) else null end
    ) as item_json
    from public.study_session_items i
    join public.questions q on q.id = i.question_id
    join public.subjects s on s.id = q.subject_id
    left join public.topics t on t.id = q.topic_id
    left join public.bookmarks b on b.user_id = actor and b.question_id = q.id and b.is_bookmarked
    left join public.session_answers a
      on a.session_id = i.session_id and a.user_id = i.user_id and a.question_id = i.question_id
    left join private.question_keys qk
      on qk.question_id = i.question_id and a.is_correct is not null
    where i.session_id = session_row.id and i.user_id = actor
  ) items;

  return jsonb_build_object(
    'session', jsonb_build_object(
      'id', session_row.id,
      'study_kind', session_row.study_kind,
      'subject_id', session_row.study_subject_id,
      'topic_id', session_row.study_topic_id,
      'target_question_count', session_row.target_question_count,
      'current_position', session_row.current_position,
      'device_version', session_row.device_version,
      'status', session_row.status::text,
      'started_at', session_row.started_at,
      'last_activity_at', session_row.last_activity_at
    ),
    'questions', package
  );
end;
$$;

create or replace function public.study_start_session(
  p_study_kind text,
  p_subject_id uuid default null,
  p_topic_id uuid default null,
  p_question_count integer default null,
  p_operation_id uuid default null
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
  requested_count integer;
  start_bucket integer;
  new_session_id uuid;
  existing_session_id uuid;
  candidate record;
  assigned_count integer := 0;
begin
  actor := private.require_m6_student();
  select p.programme_id into student_programme_id from public.profiles p where p.user_id = actor;

  if p_study_kind not in ('study_for_me','subject','topic','quick','bookmarks') then
    raise exception using errcode = '22023', message = 'unsupported Study mode';
  end if;

  if p_study_kind = 'quick' then
    requested_count := p_question_count;
    if requested_count not in (5,10,20) then
      raise exception using errcode = '22023', message = 'Quick Practice supports 5, 10 or 20 questions';
    end if;
  else
    requested_count := coalesce(p_question_count, 20);
    if requested_count < 1 or requested_count > 20 then
      raise exception using errcode = '22023', message = 'Study sessions support between 1 and 20 questions';
    end if;
  end if;

  if p_study_kind in ('study_for_me','quick','bookmarks') and (p_subject_id is not null or p_topic_id is not null) then
    raise exception using errcode = '22023', message = 'this Study mode does not accept subject/topic filters';
  end if;

  if p_study_kind = 'subject' then
    if p_subject_id is null or p_topic_id is not null then
      raise exception using errcode = '22023', message = 'Subject Practice requires one subject';
    end if;
  end if;

  if p_study_kind = 'topic' and (p_subject_id is null or p_topic_id is null) then
    raise exception using errcode = '22023', message = 'Topic Practice requires a subject and topic';
  end if;

  if p_subject_id is not null and not exists (
    select 1 from public.subjects s
    where s.id = p_subject_id and s.programme_id = student_programme_id and s.is_active
  ) then
    raise exception using errcode = '22023', message = 'selected subject is unavailable';
  end if;

  if p_topic_id is not null and not exists (
    select 1 from public.topics t
    where t.id = p_topic_id and t.subject_id = p_subject_id and t.is_active
  ) then
    raise exception using errcode = '22023', message = 'selected topic is unavailable';
  end if;

  if p_operation_id is not null then
    select s.id into existing_session_id
    from public.sessions s
    where s.user_id = actor and s.start_operation_id = p_operation_id;

    if found then
      return public.study_resume_session(existing_session_id, (select device_version from public.sessions where id = existing_session_id));
    end if;
  end if;

  if exists (
    select 1 from public.sessions s
    where s.user_id = actor
      and s.mode = 'study'
      and s.study_kind is not null
      and s.status in ('created','active')
  ) then
    raise exception using errcode = '55000', message = 'an active Study session already exists';
  end if;

  start_bucket := floor(random() * 100)::integer;

  insert into public.sessions(
    user_id, mode, status, study_kind, study_subject_id, study_topic_id,
    target_question_count, current_position, device_version, started_at,
    last_activity_at, start_operation_id
  ) values (
    actor, 'study', 'active', p_study_kind, p_subject_id, p_topic_id,
    requested_count, 1, 1, now(), now(), p_operation_id
  ) returning id into new_session_id;

  for candidate in
    with eligible as (
      select
        q.id,
        q.revision_number,
        q.subject_id,
        s.sort_order as subject_sort,
        q.random_bucket,
        case when q.random_bucket >= start_bucket then q.random_bucket - start_bucket
             else q.random_bucket + 100 - start_bucket end as bucket_distance,
        row_number() over (
          partition by q.subject_id
          order by
            case when q.random_bucket >= start_bucket then 0 else 1 end,
            q.random_bucket,
            q.id
        ) as within_subject
      from public.questions q
      join public.subjects s on s.id = q.subject_id
      where s.programme_id = student_programme_id
        and s.is_active
        and q.status = 'published'
        and private.study_question_is_eligible(q.id, student_programme_id)
        and (p_subject_id is null or q.subject_id = p_subject_id)
        and (p_topic_id is null or q.topic_id = p_topic_id)
        and (
          p_study_kind <> 'bookmarks'
          or exists (
            select 1 from public.bookmarks b
            where b.user_id = actor and b.question_id = q.id and b.is_bookmarked
          )
        )
    )
    select e.id, e.revision_number
    from eligible e
    order by
      case when p_study_kind in ('study_for_me','quick') then e.within_subject else 0 end,
      case when p_study_kind in ('study_for_me','quick') then e.subject_sort else 0 end,
      e.bucket_distance,
      e.id
    limit requested_count
  loop
    assigned_count := assigned_count + 1;
    insert into public.study_session_items(session_id, user_id, position, question_id, revision_number)
    values (new_session_id, actor, assigned_count, candidate.id, candidate.revision_number);
  end loop;

  if assigned_count = 0 or (p_study_kind = 'quick' and assigned_count < requested_count) then
    delete from public.sessions where id = new_session_id and user_id = actor;
    if p_study_kind = 'quick' then
      raise exception using errcode = 'P0002', message = 'not enough reviewed questions are available for this Quick Practice size';
    end if;
    raise exception using errcode = 'P0002', message = 'no reviewed questions are available for this Study choice yet';
  end if;

  update public.sessions s
  set target_question_count = assigned_count,
      current_position = 1,
      current_question_id = (
        select i.question_id from public.study_session_items i
        where i.session_id = new_session_id and i.position = 1
      ),
      updated_at = now()
  where s.id = new_session_id;

  return public.study_resume_session(new_session_id, 1);
end;
$$;
