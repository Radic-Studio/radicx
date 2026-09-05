-- M6 corrective boundary: SQL comparisons evaluate to UNKNOWN for NULL. Move the
-- previously validated implementations behind private, non-browser-callable names
-- and expose fail-closed wrappers for every required Study mutation input.

alter function public.study_start_session(text, uuid, uuid, integer, uuid)
  rename to study_start_session_m6_base;
alter function public.study_start_session_m6_base(text, uuid, uuid, integer, uuid)
  set schema private;

alter function public.study_submit_answer(uuid, uuid, integer, integer, uuid, integer)
  rename to study_submit_answer_m6_base;
alter function public.study_submit_answer_m6_base(uuid, uuid, integer, integer, uuid, integer)
  set schema private;

alter function public.study_set_bookmark(uuid, uuid, boolean, uuid, bigint, integer)
  rename to study_set_bookmark_m6_base;
alter function public.study_set_bookmark_m6_base(uuid, uuid, boolean, uuid, bigint, integer)
  set schema private;

alter function public.study_report_question(uuid, uuid, text, text)
  rename to study_report_question_m6_base;
alter function public.study_report_question_m6_base(uuid, uuid, text, text)
  set schema private;

alter function public.study_complete_session(uuid, integer)
  rename to study_complete_session_m6_base;
alter function public.study_complete_session_m6_base(uuid, integer)
  set schema private;

revoke execute on function private.study_start_session_m6_base(text, uuid, uuid, integer, uuid)
  from public, anon, authenticated;
revoke execute on function private.study_submit_answer_m6_base(uuid, uuid, integer, integer, uuid, integer)
  from public, anon, authenticated;
revoke execute on function private.study_set_bookmark_m6_base(uuid, uuid, boolean, uuid, bigint, integer)
  from public, anon, authenticated;
revoke execute on function private.study_report_question_m6_base(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke execute on function private.study_complete_session_m6_base(uuid, integer)
  from public, anon, authenticated;

grant execute on function private.study_start_session_m6_base(text, uuid, uuid, integer, uuid)
  to service_role;
grant execute on function private.study_submit_answer_m6_base(uuid, uuid, integer, integer, uuid, integer)
  to service_role;
grant execute on function private.study_set_bookmark_m6_base(uuid, uuid, boolean, uuid, bigint, integer)
  to service_role;
grant execute on function private.study_report_question_m6_base(uuid, uuid, text, text)
  to service_role;
grant execute on function private.study_complete_session_m6_base(uuid, integer)
  to service_role;

create function public.study_start_session(
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
begin
  if p_study_kind is null
     or p_study_kind not in ('study_for_me','subject','topic','quick','bookmarks') then
    raise exception using errcode = '22023', message = 'unsupported Study mode';
  end if;
  if p_study_kind = 'quick' and p_question_count is null then
    raise exception using errcode = '22023', message = 'Quick Practice question count is required';
  end if;

  return private.study_start_session_m6_base(
    p_study_kind,
    p_subject_id,
    p_topic_id,
    p_question_count,
    p_operation_id
  );
end;
$$;

create function public.study_submit_answer(
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
begin
  if p_selected_option is null then
    raise exception using errcode = '22023', message = 'selected option is required';
  end if;
  if p_confidence is null or p_confidence not in (1,3,5) then
    raise exception using errcode = '22023', message = 'confidence must be Guessing, Unsure or Confident';
  end if;
  if p_operation_id is null then
    raise exception using errcode = '22023', message = 'answer operation ID is required';
  end if;
  if p_device_version is null then
    raise exception using errcode = '22023', message = 'Study device version is required';
  end if;

  return private.study_submit_answer_m6_base(
    p_session_id,
    p_question_id,
    p_selected_option,
    p_confidence,
    p_operation_id,
    p_device_version
  );
end;
$$;

create function public.study_set_bookmark(
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
begin
  if p_is_bookmarked is null then
    raise exception using errcode = '22023', message = 'bookmark state is required';
  end if;
  if p_operation_id is null or p_operation_sequence is null or p_operation_sequence < 1 then
    raise exception using errcode = '22023', message = 'bookmark operation metadata is required';
  end if;
  if p_device_version is null then
    raise exception using errcode = '22023', message = 'Study device version is required';
  end if;

  return private.study_set_bookmark_m6_base(
    p_session_id,
    p_question_id,
    p_is_bookmarked,
    p_operation_id,
    p_operation_sequence,
    p_device_version
  );
end;
$$;

create function public.study_report_question(
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
begin
  if p_category is null
     or p_category not in ('incorrect','ambiguous','outdated','typo','other') then
    raise exception using errcode = '22023', message = 'unsupported report category';
  end if;

  return private.study_report_question_m6_base(
    p_session_id,
    p_question_id,
    p_category,
    p_details
  );
end;
$$;

create function public.study_complete_session(
  p_session_id uuid,
  p_device_version integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_device_version is null then
    raise exception using errcode = '22023', message = 'Study device version is required';
  end if;

  return private.study_complete_session_m6_base(p_session_id, p_device_version);
end;
$$;

revoke execute on function public.study_start_session(text, uuid, uuid, integer, uuid)
  from public, anon;
revoke execute on function public.study_submit_answer(uuid, uuid, integer, integer, uuid, integer)
  from public, anon;
revoke execute on function public.study_set_bookmark(uuid, uuid, boolean, uuid, bigint, integer)
  from public, anon;
revoke execute on function public.study_report_question(uuid, uuid, text, text)
  from public, anon;
revoke execute on function public.study_complete_session(uuid, integer)
  from public, anon;

grant execute on function public.study_start_session(text, uuid, uuid, integer, uuid)
  to authenticated;
grant execute on function public.study_submit_answer(uuid, uuid, integer, integer, uuid, integer)
  to authenticated;
grant execute on function public.study_set_bookmark(uuid, uuid, boolean, uuid, bigint, integer)
  to authenticated;
grant execute on function public.study_report_question(uuid, uuid, text, text)
  to authenticated;
grant execute on function public.study_complete_session(uuid, integer)
  to authenticated;
