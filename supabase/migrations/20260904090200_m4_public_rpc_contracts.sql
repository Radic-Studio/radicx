-- Keep browser-callable RPC signatures within the exposed public type boundary.
-- Private enum types remain implementation details and are cast only after authorization.

drop function public.admin_create_source(text, text, text, smallint, private.rights_status, text, text, text);

create or replace function public.admin_create_source(
  p_source_class text,
  p_label text,
  p_public_reference text default null,
  p_provenance_confidence smallint default null,
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

  insert into public.question_sources(source_class, label, public_reference)
  values (p_source_class, trim(p_label), p_public_reference)
  returning id into new_source_id;

  insert into private.question_source_governance(
    source_id, provenance_confidence, rights_status, rights_notes_private,
    evidence_reference_private, licence_reference_private, reviewed_by, reviewed_at
  ) values (
    new_source_id, p_provenance_confidence, rights_value, p_rights_notes_private,
    p_evidence_reference_private, p_licence_reference_private, actor,
    case when rights_value not in ('unknown','pending') then now() else null end
  );

  perform private.audit_content(actor, 'source_create', 'question_source', new_source_id,
    jsonb_build_object('source_class', p_source_class, 'rights_status', rights_value::text));

  return new_source_id;
end;
$$;

drop function public.admin_record_question_review(uuid, private.review_type, private.review_decision, text, boolean);

create or replace function public.admin_record_question_review(
  p_question_id uuid,
  p_review_type text,
  p_decision text,
  p_notes_private text default null,
  p_is_enhanced boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  review_id uuid;
  review_type_value private.review_type;
  decision_value private.review_decision;
begin
  review_type_value := p_review_type::private.review_type;
  decision_value := p_decision::private.review_decision;

  if review_type_value = 'clinical' then
    actor := private.require_staff(array['clinical_reviewer']::private.staff_role[]);
  elsif review_type_value = 'item' then
    actor := private.require_staff(array['item_reviewer']::private.staff_role[]);
  else
    actor := private.require_staff(array['content_admin']::private.staff_role[]);
  end if;

  if not exists (select 1 from public.questions q where q.id = p_question_id and q.status = 'review') then
    raise exception using errcode = '55000', message = 'question must be in review state';
  end if;

  if p_is_enhanced and review_type_value <> 'clinical' then
    raise exception using errcode = '22023', message = 'enhanced review flag is only valid for clinical review';
  end if;

  insert into private.question_reviews(question_id, review_type, decision, is_enhanced, notes_private, reviewer_id)
  values (p_question_id, review_type_value, decision_value, p_is_enhanced, p_notes_private, actor)
  returning id into review_id;

  perform private.audit_content(actor, 'question_review_record', 'question', p_question_id,
    jsonb_build_object('review_type', review_type_value::text, 'decision', decision_value::text, 'enhanced', p_is_enhanced));

  return review_id;
end;
$$;

create or replace function public.admin_question_gate_status(p_question_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  q public.questions%rowtype;
  rights_status_text text;
  key_valid boolean;
  rights_ok boolean;
  clinical_ok boolean;
  item_ok boolean;
  enhanced_ok boolean;
  taxonomy_ok boolean;
begin
  perform private.require_staff(array['content_editor','clinical_reviewer','item_reviewer','content_admin']::private.staff_role[]);

  select * into q from public.questions where id = p_question_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'question not found';
  end if;

  select qsg.rights_status::text into rights_status_text
  from private.question_source_governance qsg
  where qsg.source_id = q.source_id;

  select exists (
    select 1
    from private.question_keys qk
    where qk.question_id = q.id
      and qk.correct_option >= 0
      and qk.correct_option < jsonb_array_length(q.options)
  ) into key_valid;

  rights_ok := rights_status_text in ('owned','licensed','permission_confirmed','public_domain')
    and coalesce((
      select qr.decision = 'approved'
      from private.question_reviews qr
      where qr.question_id = q.id and qr.review_type = 'rights'
      order by qr.created_at desc, qr.id desc
      limit 1
    ), false);

  clinical_ok := coalesce((
    select qr.decision = 'approved'
    from private.question_reviews qr
    where qr.question_id = q.id and qr.review_type = 'clinical' and not qr.is_enhanced
    order by qr.created_at desc, qr.id desc
    limit 1
  ), false);

  item_ok := coalesce((
    select qr.decision = 'approved'
    from private.question_reviews qr
    where qr.question_id = q.id and qr.review_type = 'item'
    order by qr.created_at desc, qr.id desc
    limit 1
  ), false);

  enhanced_ok := q.risk_tier = 'standard' or exists (
    select 1 from private.question_reviews qr
    where qr.question_id = q.id
      and qr.review_type = 'clinical'
      and qr.is_enhanced
      and qr.decision = 'approved'
  );

  taxonomy_ok := q.cognitive_level is not null
    and q.clinical_task is not null
    and exists (select 1 from public.cognitive_levels c where c.code = q.cognitive_level and c.is_active)
    and exists (select 1 from public.clinical_tasks c where c.code = q.clinical_task and c.is_active);

  return jsonb_build_object(
    'question_id', q.id,
    'status', q.status::text,
    'rights_ok', rights_ok,
    'clinical_ok', clinical_ok,
    'item_ok', item_ok,
    'enhanced_review_ok', enhanced_ok,
    'taxonomy_ok', taxonomy_ok,
    'answer_key_present', key_valid,
    'publishable', q.status = 'review' and rights_ok and clinical_ok and item_ok and enhanced_ok and taxonomy_ok and key_valid
  );
end;
$$;

create or replace function public.admin_stage_import_row(
  p_batch_id uuid,
  p_row_number integer,
  p_raw_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  errors jsonb := '[]'::jsonb;
  candidate_fingerprint text;
  stored_fingerprint text;
  row_state private.import_row_status := 'staged'::private.import_row_status;
  import_row_id uuid;
  options jsonb;
  stem text;
begin
  actor := private.require_staff(array['content_editor','content_admin']::private.staff_role[]);

  if not exists (select 1 from private.import_batches b where b.id = p_batch_id) then
    raise exception using errcode = 'P0002', message = 'import batch not found';
  end if;

  if p_row_number <= 0 or jsonb_typeof(p_raw_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'positive row number and JSON object payload are required';
  end if;

  stem := nullif(trim(p_raw_payload ->> 'stem'), '');
  options := p_raw_payload -> 'options';

  if stem is null then
    errors := errors || jsonb_build_array('missing_stem');
  end if;

  if options is null or jsonb_typeof(options) <> 'array' or jsonb_array_length(options) not between 2 and 10 then
    errors := errors || jsonb_build_array('invalid_options');
  elsif exists (
    select 1 from jsonb_array_elements(options) as item(value)
    where jsonb_typeof(item.value) <> 'string' or trim(item.value #>> '{}') = ''
  ) then
    errors := errors || jsonb_build_array('invalid_options');
  end if;

  if jsonb_typeof(p_raw_payload -> 'correct_option') <> 'number' then
    errors := errors || jsonb_build_array('invalid_correct_option');
  end if;

  if nullif(trim(p_raw_payload ->> 'subject_id'), '') is null then
    errors := errors || jsonb_build_array('missing_subject_id');
  end if;

  if nullif(trim(p_raw_payload ->> 'cognitive_level'), '') is null then
    errors := errors || jsonb_build_array('missing_cognitive_level');
  end if;

  if nullif(trim(p_raw_payload ->> 'clinical_task'), '') is null then
    errors := errors || jsonb_build_array('missing_clinical_task');
  end if;

  if jsonb_array_length(errors) = 0 then
    candidate_fingerprint := private.question_content_fingerprint(stem, options);

    if exists (select 1 from public.questions q where q.content_fingerprint = candidate_fingerprint)
       or exists (
         select 1 from private.import_rows ir
         where ir.batch_id = p_batch_id
           and ir.row_fingerprint = candidate_fingerprint
           and ir.row_number <> p_row_number
       ) then
      errors := errors || jsonb_build_array('duplicate_question');
      row_state := 'duplicate'::private.import_row_status;
      stored_fingerprint := null;
    else
      stored_fingerprint := candidate_fingerprint;
    end if;
  else
    row_state := 'invalid'::private.import_row_status;
  end if;

  insert into private.import_rows(
    batch_id, row_number, raw_payload, row_fingerprint,
    validation_errors, status, updated_at
  ) values (
    p_batch_id, p_row_number, p_raw_payload, stored_fingerprint,
    errors, row_state, now()
  )
  on conflict (batch_id, row_number) do update
    set raw_payload = excluded.raw_payload,
        row_fingerprint = excluded.row_fingerprint,
        validation_errors = excluded.validation_errors,
        status = excluded.status,
        promoted_question_id = null,
        updated_at = now()
  returning id into import_row_id;

  update private.import_batches
  set status = 'staging', updated_at = now()
  where id = p_batch_id;

  perform private.audit_content(actor, 'import_row_stage', 'import_row', import_row_id,
    jsonb_build_object('row_number', p_row_number, 'status', row_state::text));

  return import_row_id;
end;
$$;

revoke execute on function public.admin_create_source(text, text, text, smallint, text, text, text, text) from public, anon;
revoke execute on function public.admin_record_question_review(uuid, text, text, text, boolean) from public, anon;
revoke execute on function public.admin_question_gate_status(uuid) from public, anon;
revoke execute on function public.admin_stage_import_row(uuid, integer, jsonb) from public, anon;

grant execute on function public.admin_create_source(text, text, text, smallint, text, text, text, text) to authenticated;
grant execute on function public.admin_record_question_review(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.admin_question_gate_status(uuid) to authenticated;
grant execute on function public.admin_stage_import_row(uuid, integer, jsonb) to authenticated;
