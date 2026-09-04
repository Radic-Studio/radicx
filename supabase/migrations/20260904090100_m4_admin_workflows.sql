create unique index questions_one_open_revision_per_group
  on public.questions(revision_group_id)
  where status in ('draft','review');

create or replace function private.require_staff(required_roles private.staff_role[])
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
    raise exception using errcode = '42501', message = 'authenticated staff session required';
  end if;

  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception using errcode = '42501', message = 'AAL2 is required for administrative content actions';
  end if;

  if not exists (
    select 1
    from private.staff_roles sr
    where sr.user_id = actor
      and sr.role = any(required_roles)
  ) then
    raise exception using errcode = '42501', message = 'insufficient staff role';
  end if;

  return actor;
end;
$$;

create or replace function private.audit_content(
  actor uuid,
  action_name text,
  entity_kind text,
  entity uuid,
  audit_details jsonb default '{}'::jsonb
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into private.content_audit_log(actor_user_id, action, entity_type, entity_id, details)
  values (actor, action_name, entity_kind, entity, coalesce(audit_details, '{}'::jsonb));
$$;

create or replace function public.is_content_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (
      select 1
      from private.staff_roles sr
      where sr.user_id = auth.uid()
        and sr.role in ('content_editor','clinical_reviewer','item_reviewer','content_admin')
    );
$$;

create or replace function public.is_content_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (
      select 1
      from private.staff_roles sr
      where sr.user_id = auth.uid()
        and sr.role = 'content_admin'
    );
$$;

create or replace function public.admin_upsert_taxonomy_term(
  p_dimension text,
  p_code text,
  p_name text,
  p_description text default null,
  p_sort_order integer default 0
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  clean_code text := lower(trim(p_code));
begin
  actor := private.require_staff(array['content_admin']::private.staff_role[]);

  if clean_code = '' or trim(p_name) = '' or p_sort_order < 0 then
    raise exception using errcode = '22023', message = 'valid taxonomy code, name and sort order are required';
  end if;

  if p_dimension = 'cognitive_level' then
    insert into public.cognitive_levels(code, name, description, sort_order, is_active, updated_at)
    values (clean_code, trim(p_name), p_description, p_sort_order, true, now())
    on conflict (code) do update
      set name = excluded.name,
          description = excluded.description,
          sort_order = excluded.sort_order,
          is_active = true,
          updated_at = now();
  elsif p_dimension = 'clinical_task' then
    insert into public.clinical_tasks(code, name, description, sort_order, is_active, updated_at)
    values (clean_code, trim(p_name), p_description, p_sort_order, true, now())
    on conflict (code) do update
      set name = excluded.name,
          description = excluded.description,
          sort_order = excluded.sort_order,
          is_active = true,
          updated_at = now();
  else
    raise exception using errcode = '22023', message = 'unsupported taxonomy dimension';
  end if;

  perform private.audit_content(actor, 'taxonomy_upsert', p_dimension, null, jsonb_build_object('code', clean_code));
  return clean_code;
end;
$$;

create or replace function public.admin_create_source(
  p_source_class text,
  p_label text,
  p_public_reference text default null,
  p_provenance_confidence smallint default null,
  p_rights_status private.rights_status default 'pending',
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
begin
  actor := private.require_staff(array['content_admin']::private.staff_role[]);

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
    new_source_id, p_provenance_confidence, p_rights_status, p_rights_notes_private,
    p_evidence_reference_private, p_licence_reference_private, actor,
    case when p_rights_status not in ('unknown','pending') then now() else null end
  );

  perform private.audit_content(actor, 'source_create', 'question_source', new_source_id,
    jsonb_build_object('source_class', p_source_class, 'rights_status', p_rights_status::text));

  return new_source_id;
end;
$$;

create or replace function public.admin_create_question(
  p_subject_id uuid,
  p_topic_id uuid,
  p_source_id uuid,
  p_stem text,
  p_options jsonb,
  p_cognitive_level text,
  p_clinical_task text,
  p_risk_tier public.question_risk_tier,
  p_correct_option smallint,
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
  values (new_question_id, p_correct_option, p_explanation_private);

  insert into private.question_governance(question_id)
  values (new_question_id);

  perform private.audit_content(actor, 'question_create', 'question', new_question_id,
    jsonb_build_object('risk_tier', p_risk_tier::text));

  return new_question_id;
end;
$$;

create or replace function public.admin_set_question_key(
  p_question_id uuid,
  p_correct_option smallint,
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
  values (p_question_id, p_correct_option, p_explanation_private, now())
  on conflict (question_id) do update
    set correct_option = excluded.correct_option,
        explanation_private = excluded.explanation_private,
        updated_at = now();

  perform private.audit_content(actor, 'question_key_update', 'question', p_question_id);
end;
$$;

create or replace function public.admin_submit_question_for_review(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  affected integer;
begin
  actor := private.require_staff(array['content_editor','content_admin']::private.staff_role[]);

  update public.questions
  set status = 'review', updated_at = now()
  where id = p_question_id and status = 'draft';
  get diagnostics affected = row_count;

  if affected <> 1 then
    raise exception using errcode = '55000', message = 'only draft questions can enter review';
  end if;

  perform private.audit_content(actor, 'question_submit_review', 'question', p_question_id);
end;
$$;

create or replace function public.admin_record_question_review(
  p_question_id uuid,
  p_review_type private.review_type,
  p_decision private.review_decision,
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
begin
  if p_review_type = 'clinical' then
    actor := private.require_staff(array['clinical_reviewer']::private.staff_role[]);
  elsif p_review_type = 'item' then
    actor := private.require_staff(array['item_reviewer']::private.staff_role[]);
  else
    actor := private.require_staff(array['content_admin']::private.staff_role[]);
  end if;

  if not exists (select 1 from public.questions q where q.id = p_question_id and q.status = 'review') then
    raise exception using errcode = '55000', message = 'question must be in review state';
  end if;

  if p_is_enhanced and p_review_type <> 'clinical' then
    raise exception using errcode = '22023', message = 'enhanced review flag is only valid for clinical review';
  end if;

  insert into private.question_reviews(question_id, review_type, decision, is_enhanced, notes_private, reviewer_id)
  values (p_question_id, p_review_type, p_decision, p_is_enhanced, p_notes_private, actor)
  returning id into review_id;

  perform private.audit_content(actor, 'question_review_record', 'question', p_question_id,
    jsonb_build_object('review_type', p_review_type::text, 'decision', p_decision::text, 'enhanced', p_is_enhanced));

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
  actor uuid;
  q public.questions%rowtype;
  rights_status_text text;
  key_valid boolean;
  rights_ok boolean;
  clinical_ok boolean;
  item_ok boolean;
  enhanced_ok boolean;
  taxonomy_ok boolean;
begin
  actor := private.require_staff(array['content_editor','clinical_reviewer','item_reviewer','content_admin']::private.staff_role[]);

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

create or replace function public.admin_publish_question(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  gate jsonb;
begin
  actor := private.require_staff(array['content_admin']::private.staff_role[]);
  gate := public.admin_question_gate_status(p_question_id);

  if not coalesce((gate ->> 'publishable')::boolean, false) then
    raise exception using errcode = '55000', message = 'publication gates are not satisfied';
  end if;

  update public.questions
  set status = 'published', published_at = now(), updated_at = now()
  where id = p_question_id and status = 'review';

  perform private.audit_content(actor, 'question_publish', 'question', p_question_id, gate - 'answer_key_present');
end;
$$;

create or replace function public.admin_create_question_revision(p_question_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  source_question public.questions%rowtype;
  new_question_id uuid;
  next_revision integer;
begin
  actor := private.require_staff(array['content_editor','content_admin']::private.staff_role[]);

  select * into source_question
  from public.questions
  where id = p_question_id and status in ('published','quarantined','archived');

  if not found then
    raise exception using errcode = '55000', message = 'revision source must be published, quarantined or archived';
  end if;

  select max(revision_number) + 1 into next_revision
  from public.questions
  where revision_group_id = source_question.revision_group_id;

  insert into public.questions(
    revision_group_id, revision_number, supersedes_question_id,
    subject_id, topic_id, source_id, status, stem, options,
    cognitive_level, clinical_task, risk_tier, random_bucket
  ) values (
    source_question.revision_group_id, next_revision, source_question.id,
    source_question.subject_id, source_question.topic_id, source_question.source_id, 'draft',
    source_question.stem, source_question.options, source_question.cognitive_level,
    source_question.clinical_task, source_question.risk_tier, source_question.random_bucket
  ) returning id into new_question_id;

  insert into private.question_keys(question_id, correct_option, explanation_private)
  select new_question_id, correct_option, explanation_private
  from private.question_keys where question_id = source_question.id;

  insert into private.question_governance(
    question_id, clinical_validity, item_writing_quality, educational_relevance,
    reviewer_estimated_difficulty, freshness_review_due_at
  )
  select new_question_id, clinical_validity, item_writing_quality, educational_relevance,
    reviewer_estimated_difficulty, freshness_review_due_at
  from private.question_governance where question_id = source_question.id;

  insert into private.question_governance(question_id)
  values (new_question_id)
  on conflict (question_id) do nothing;

  perform private.audit_content(actor, 'question_revision_create', 'question', new_question_id,
    jsonb_build_object('supersedes_question_id', source_question.id, 'revision_number', next_revision));

  return new_question_id;
end;
$$;

create or replace function public.admin_quarantine_question(p_question_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  affected integer;
begin
  actor := private.require_staff(array['content_admin']::private.staff_role[]);

  if trim(coalesce(p_reason, '')) = '' then
    raise exception using errcode = '22023', message = 'quarantine reason is required';
  end if;

  update public.questions
  set status = 'quarantined', updated_at = now()
  where id = p_question_id and status = 'published';
  get diagnostics affected = row_count;

  if affected <> 1 then
    raise exception using errcode = '55000', message = 'only published questions can be quarantined';
  end if;

  perform private.audit_content(actor, 'question_quarantine', 'question', p_question_id,
    jsonb_build_object('reason', trim(p_reason)));
end;
$$;

create or replace function public.admin_create_import_batch(
  p_source_id uuid,
  p_original_filename text,
  p_file_sha256 text,
  p_mapping jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  fingerprint text;
  batch_id uuid;
begin
  actor := private.require_staff(array['content_editor','content_admin']::private.staff_role[]);

  if trim(p_original_filename) = '' or p_file_sha256 !~ '^[0-9a-fA-F]{64}$' then
    raise exception using errcode = '22023', message = 'filename and SHA-256 fingerprint are required';
  end if;

  if jsonb_typeof(p_mapping) <> 'object' then
    raise exception using errcode = '22023', message = 'import mapping must be a JSON object';
  end if;

  if p_source_id is not null and not exists (select 1 from public.question_sources where id = p_source_id) then
    raise exception using errcode = '23503', message = 'import source does not exist';
  end if;

  fingerprint := encode(extensions.digest(convert_to(
    coalesce(p_source_id::text, '') || '|' || lower(p_file_sha256) || '|' || p_mapping::text,
    'UTF8'), 'sha256'), 'hex');

  insert into private.import_batches(
    source_id, original_filename, file_sha256, mapping, batch_fingerprint,
    status, created_by, updated_at
  ) values (
    p_source_id, trim(p_original_filename), lower(p_file_sha256), p_mapping, fingerprint,
    'uploaded', actor, now()
  )
  on conflict (batch_fingerprint) do update set updated_at = now()
  returning id into batch_id;

  perform private.audit_content(actor, 'import_batch_stage', 'import_batch', batch_id,
    jsonb_build_object('batch_fingerprint', fingerprint));

  return batch_id;
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
  row_state private.import_row_status := 'staged';
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
      row_state := 'duplicate';
      stored_fingerprint := null;
    else
      stored_fingerprint := candidate_fingerprint;
    end if;
  else
    row_state := 'invalid';
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
    (payload ->> 'correct_option')::smallint,
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

create or replace function public.admin_list_questions(p_status public.question_status default null, p_limit integer default 100)
returns table(
  id uuid,
  revision_group_id uuid,
  revision_number integer,
  status public.question_status,
  subject_id uuid,
  topic_id uuid,
  source_id uuid,
  stem text,
  options jsonb,
  cognitive_level text,
  clinical_task text,
  risk_tier public.question_risk_tier,
  published_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_staff(array['content_editor','clinical_reviewer','item_reviewer','content_admin']::private.staff_role[]);

  return query
  select q.id, q.revision_group_id, q.revision_number, q.status,
    q.subject_id, q.topic_id, q.source_id, q.stem, q.options,
    q.cognitive_level, q.clinical_task, q.risk_tier, q.published_at, q.updated_at
  from public.questions q
  where p_status is null or q.status = p_status
  order by q.updated_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

-- Content administration storage is private and staff-scoped. Object names are
-- constrained to the authenticated staff user's UUID prefix.
grant select, insert, update, delete on storage.objects to authenticated;

create policy m4_admin_uploads_staff_select
on storage.objects for select to authenticated
using (
  bucket_id = 'admin-uploads'
  and public.is_content_staff()
  and name like (select auth.uid())::text || '/%'
);

create policy m4_admin_uploads_staff_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'admin-uploads'
  and public.is_content_staff()
  and name like (select auth.uid())::text || '/%'
);

create policy m4_admin_uploads_staff_update
on storage.objects for update to authenticated
using (
  bucket_id = 'admin-uploads'
  and public.is_content_staff()
  and name like (select auth.uid())::text || '/%'
)
with check (
  bucket_id = 'admin-uploads'
  and public.is_content_staff()
  and name like (select auth.uid())::text || '/%'
);

create policy m4_admin_uploads_staff_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'admin-uploads'
  and public.is_content_staff()
  and name like (select auth.uid())::text || '/%'
);

create policy m4_source_evidence_admin_select
on storage.objects for select to authenticated
using (
  bucket_id = 'source-evidence'
  and public.is_content_admin()
  and name like (select auth.uid())::text || '/%'
);

create policy m4_source_evidence_admin_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'source-evidence'
  and public.is_content_admin()
  and name like (select auth.uid())::text || '/%'
);

create policy m4_source_evidence_admin_update
on storage.objects for update to authenticated
using (
  bucket_id = 'source-evidence'
  and public.is_content_admin()
  and name like (select auth.uid())::text || '/%'
)
with check (
  bucket_id = 'source-evidence'
  and public.is_content_admin()
  and name like (select auth.uid())::text || '/%'
);

create policy m4_source_evidence_admin_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'source-evidence'
  and public.is_content_admin()
  and name like (select auth.uid())::text || '/%'
);

revoke execute on function private.require_staff(private.staff_role[]) from public, anon, authenticated;
revoke execute on function private.audit_content(uuid, text, text, uuid, jsonb) from public, anon, authenticated;

grant execute on function public.is_content_staff() to authenticated;
grant execute on function public.is_content_admin() to authenticated;
grant execute on function public.admin_upsert_taxonomy_term(text, text, text, text, integer) to authenticated;
grant execute on function public.admin_create_source(text, text, text, smallint, private.rights_status, text, text, text) to authenticated;
grant execute on function public.admin_create_question(uuid, uuid, uuid, text, jsonb, text, text, public.question_risk_tier, smallint, text) to authenticated;
grant execute on function public.admin_set_question_key(uuid, smallint, text) to authenticated;
grant execute on function public.admin_submit_question_for_review(uuid) to authenticated;
grant execute on function public.admin_record_question_review(uuid, private.review_type, private.review_decision, text, boolean) to authenticated;
grant execute on function public.admin_question_gate_status(uuid) to authenticated;
grant execute on function public.admin_publish_question(uuid) to authenticated;
grant execute on function public.admin_create_question_revision(uuid) to authenticated;
grant execute on function public.admin_quarantine_question(uuid, text) to authenticated;
grant execute on function public.admin_create_import_batch(uuid, text, text, jsonb) to authenticated;
grant execute on function public.admin_stage_import_row(uuid, integer, jsonb) to authenticated;
grant execute on function public.admin_promote_import_row_to_draft(uuid) to authenticated;
grant execute on function public.admin_list_questions(public.question_status, integer) to authenticated;
