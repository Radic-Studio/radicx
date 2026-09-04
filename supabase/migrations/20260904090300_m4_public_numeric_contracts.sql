-- Normalize browser-callable numeric arguments to integer. PostgreSQL/PostgREST
-- commonly resolves JSON whole numbers as integer; private storage can retain
-- the narrower smallint representation after explicit validation and casting.

drop function public.admin_create_source(text, text, text, smallint, text, text, text, text);

create or replace function public.admin_create_source(
  p_source_class text,
  p_label text,
  p_public_reference text default null,
  p_provenance_confidence integer default null,
  p_rights_status text default 'pending',
  p_rights_notes_private text default null,
  p_evidence_reference_private text default null,
  p_licence_reference_private text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  new_source_id uuid;
  rights_value private.rights_status;
begin
  actor := private.require_staff(array['content_admin']::private.staff_role[]);
  rights_value := p_rights_status::private.rights_status;

  if trim(p_label) = '' then
    raise exception using errcode = '22023', message = 'source label is required';
  end if;

  if p_provenance_confidence is not null and p_provenance_confidence not between 0 and 100 then
    raise exception using errcode = '22023', message = 'provenance confidence must be between 0 and 100';
  end if;

  insert into public.question_sources(source_class, label, public_reference)
  values (p_source_class, trim(p_label), p_public_reference)
  returning id into new_source_id;

  insert into private.question_source_governance(
    source_id, provenance_confidence, rights_status, rights_notes_private,
    evidence_reference_private, licence_reference_private, reviewed_by, reviewed_at
  ) values (
    new_source_id, p_provenance_confidence::smallint, rights_value, p_rights_notes_private,
    p_evidence_reference_private, p_licence_reference_private, actor,
    case when rights_value not in ('unknown','pending') then now() else null end
  );

  perform private.audit_content(actor, 'source_create', 'question_source', new_source_id,
    jsonb_build_object('source_class', p_source_class, 'rights_status', rights_value::text));

  return new_source_id;
end;
$$;

drop function public.admin_create_question(uuid, uuid, uuid, text, jsonb, text, text, public.question_risk_tier, smallint, text);

create or replace function public.admin_create_question(
  p_subject_id uuid,
  p_topic_id uuid,
  p_source_id uuid,
  p_stem text,
  p_options jsonb,
  p_cognitive_level text,
  p_clinical_task text,
  p_risk_tier public.question_risk_tier,
  p_correct_option integer,
  p_explanation_private text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  new_question_id uuid;
  option_count integer;
begin
  actor := private.require_staff(array['content_editor','content_admin']::private.staff_role[]);

  if trim(p_stem) = '' then
    raise exception using errcode = '22023', message = 'question stem is required';
  end if;

  if jsonb_typeof(p_options) <> 'array' then
    raise exception using errcode = '22023', message = 'question options must be an array';
  end if;

  option_count := jsonb_array_length(p_options);
  if option_count < 2 or option_count > 10 then
    raise exception using errcode = '22023', message = 'question must contain between 2 and 10 options';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_options) as item(value)
    where jsonb_typeof(item.value) <> 'string'
       or trim(item.value #>> '{}') = ''
  ) then
    raise exception using errcode = '22023', message = 'every question option must be a non-empty string';
  end if;

  if p_correct_option < 0 or p_correct_option >= option_count then
    raise exception using errcode = '22023', message = 'correct option is outside the option array';
  end if;

  if not exists (select 1 from public.subjects s where s.id = p_subject_id and s.is_active) then
    raise exception using errcode = '23503', message = 'active subject is required';
  end if;

  if p_topic_id is not null and not exists (
    select 1 from public.topics t where t.id = p_topic_id and t.subject_id = p_subject_id and t.is_active
  ) then
    raise exception using errcode = '23503', message = 'topic must be active and belong to the selected subject';
  end if;

  if not exists (select 1 from public.question_sources qs where qs.id = p_source_id) then
    raise exception using errcode = '23503', message = 'question source is required';
  end if;

  if not exists (select 1 from public.cognitive_levels c where c.code = p_cognitive_level and c.is_active) then
    raise exception using errcode = '23503', message = 'active cognitive level is required';
  end if;

  if not exists (select 1 from public.clinical_tasks c where c.code = p_clinical_task and c.is_active) then
    raise exception using errcode = '23503', message = 'active clinical task is required';
  end if;

  insert into public.questions(
    subject_id, topic_id, source_id, status, stem, options,
    cognitive_level, clinical_task, risk_tier
  ) values (
    p_subject_id, p_topic_id, p_source_id, 'draft', trim(p_stem), p_options,
    p_cognitive_level, p_clinical_task, p_risk_tier
  ) returning id into new_question_id;

  insert into private.question_keys(question_id, correct_option, explanation_private)
  values (new_question_id, p_correct_option::smallint, p_explanation_private);

  insert into private.question_governance(question_id)
  values (new_question_id);

  perform private.audit_content(actor, 'question_create', 'question', new_question_id,
    jsonb_build_object('risk_tier', p_risk_tier::text));

  return new_question_id;
end;
$$;

drop function public.admin_set_question_key(uuid, smallint, text);

create or replace function public.admin_set_question_key(
  p_question_id uuid,
  p_correct_option integer,
  p_explanation_private text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  option_count integer;
  current_status public.question_status;
begin
  actor := private.require_staff(array['content_editor','content_admin']::private.staff_role[]);

  select jsonb_array_length(q.options), q.status
  into option_count, current_status
  from public.questions q
  where q.id = p_question_id;

  if option_count is null then
    raise exception using errcode = 'P0002', message = 'question not found';
  end if;

  if current_status not in ('draft','review') then
    raise exception using errcode = '55000', message = 'answer keys may only be changed on draft or review revisions';
  end if;

  if p_correct_option < 0 or p_correct_option >= option_count then
    raise exception using errcode = '22023', message = 'correct option is outside the option array';
  end if;

  insert into private.question_keys(question_id, correct_option, explanation_private, updated_at)
  values (p_question_id, p_correct_option::smallint, p_explanation_private, now())
  on conflict (question_id) do update
    set correct_option = excluded.correct_option,
        explanation_private = excluded.explanation_private,
        updated_at = now();

  perform private.audit_content(actor, 'question_key_update', 'question', p_question_id);
end;
$$;

create or replace function public.admin_promote_import_row_to_draft(p_import_row_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  row_record private.import_rows%rowtype;
  batch_record private.import_batches%rowtype;
  payload jsonb;
  new_question_id uuid;
  risk public.question_risk_tier;
begin
  actor := private.require_staff(array['content_editor','content_admin']::private.staff_role[]);

  select * into row_record from private.import_rows where id = p_import_row_id;
  if not found or row_record.status <> 'staged' or jsonb_array_length(row_record.validation_errors) <> 0 then
    raise exception using errcode = '55000', message = 'only valid staged import rows can be promoted';
  end if;

  select * into batch_record from private.import_batches where id = row_record.batch_id;
  payload := row_record.raw_payload;
  risk := coalesce(nullif(payload ->> 'risk_tier', '')::public.question_risk_tier, 'standard'::public.question_risk_tier);

  new_question_id := public.admin_create_question(
    (payload ->> 'subject_id')::uuid,
    nullif(payload ->> 'topic_id', '')::uuid,
    coalesce(nullif(payload ->> 'source_id', '')::uuid, batch_record.source_id),
    payload ->> 'stem',
    payload -> 'options',
    payload ->> 'cognitive_level',
    payload ->> 'clinical_task',
    risk,
    (payload ->> 'correct_option')::integer,
    payload ->> 'explanation_private'
  );

  update private.import_rows
  set status = 'promoted', promoted_question_id = new_question_id, updated_at = now()
  where id = p_import_row_id;

  if not exists (
    select 1 from private.import_rows ir
    where ir.batch_id = row_record.batch_id and ir.status = 'staged'
  ) then
    update private.import_batches
    set status = 'completed', updated_at = now()
    where id = row_record.batch_id;
  end if;

  perform private.audit_content(actor, 'import_row_promote', 'import_row', p_import_row_id,
    jsonb_build_object('question_id', new_question_id));

  return new_question_id;
end;
$$;

revoke execute on function public.admin_create_source(text, text, text, integer, text, text, text, text) from public, anon;
revoke execute on function public.admin_create_question(uuid, uuid, uuid, text, jsonb, text, text, public.question_risk_tier, integer, text) from public, anon;
revoke execute on function public.admin_set_question_key(uuid, integer, text) from public, anon;
revoke execute on function public.admin_promote_import_row_to_draft(uuid) from public, anon;

grant execute on function public.admin_create_source(text, text, text, integer, text, text, text, text) to authenticated;
grant execute on function public.admin_create_question(uuid, uuid, uuid, text, jsonb, text, text, public.question_risk_tier, integer, text) to authenticated;
grant execute on function public.admin_set_question_key(uuid, integer, text) to authenticated;
grant execute on function public.admin_promote_import_row_to_draft(uuid) to authenticated;
