create type public.question_risk_tier as enum ('standard','high');
create type private.review_type as enum ('rights','clinical','item');
create type private.review_decision as enum ('approved','changes_requested','rejected');
create type private.rights_status as enum ('unknown','pending','owned','licensed','permission_confirmed','public_domain','restricted','rejected');
create type private.import_status as enum ('uploaded','parsed','mapped','validated','staging','completed','failed');
create type private.import_row_status as enum ('staged','invalid','duplicate','promoted');

create table public.cognitive_levels (
  code text primary key,
  name text not null,
  description text,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clinical_tasks (
  code text primary key,
  name text not null,
  description text,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Existing synthetic M2 fixtures are registered only so the new taxonomy FKs can
-- be validated without pretending these are authoritative production taxonomy terms.
insert into public.cognitive_levels(code, name, description, sort_order) values
('recall','Recall','Synthetic development taxonomy fixture carried forward from M2.',1),
('application','Application','Synthetic development taxonomy fixture carried forward from M2.',2)
on conflict (code) do nothing;

insert into public.clinical_tasks(code, name, description, sort_order) values
('development_fixture','Development fixture','Synthetic development-only clinical task carried forward from M2.',1)
on conflict (code) do nothing;

alter table public.questions
  add column risk_tier public.question_risk_tier not null default 'standard',
  add column content_fingerprint text;

alter table public.questions
  add constraint questions_cognitive_level_fk
    foreign key (cognitive_level) references public.cognitive_levels(code) on update cascade on delete restrict,
  add constraint questions_clinical_task_fk
    foreign key (clinical_task) references public.clinical_tasks(code) on update cascade on delete restrict;

create table private.question_source_governance (
  source_id uuid primary key references public.question_sources(id) on delete cascade,
  provenance_confidence smallint check (provenance_confidence is null or provenance_confidence between 0 and 100),
  rights_status private.rights_status not null default 'unknown',
  rights_notes_private text,
  evidence_reference_private text,
  licence_reference_private text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  next_review_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.question_governance (
  question_id uuid primary key references public.questions(id) on delete cascade,
  clinical_validity smallint check (clinical_validity is null or clinical_validity between 0 and 100),
  item_writing_quality smallint check (item_writing_quality is null or item_writing_quality between 0 and 100),
  educational_relevance smallint check (educational_relevance is null or educational_relevance between 0 and 100),
  reviewer_estimated_difficulty smallint check (reviewer_estimated_difficulty is null or reviewer_estimated_difficulty between 1 and 5),
  freshness_review_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.question_reviews (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  review_type private.review_type not null,
  decision private.review_decision not null,
  is_enhanced boolean not null default false,
  notes_private text,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table private.import_batches (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.question_sources(id) on delete restrict,
  original_filename text not null,
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-fA-F]{64}$'),
  mapping jsonb not null default '{}'::jsonb check (jsonb_typeof(mapping) = 'object'),
  batch_fingerprint text not null unique,
  status private.import_status not null default 'uploaded',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references private.import_batches(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  row_fingerprint text,
  validation_errors jsonb not null default '[]'::jsonb check (jsonb_typeof(validation_errors) = 'array'),
  status private.import_row_status not null default 'staged',
  promoted_question_id uuid references public.questions(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(batch_id, row_number)
);

create unique index import_rows_batch_fingerprint_uniq
  on private.import_rows(batch_id, row_fingerprint)
  where row_fingerprint is not null;

create table private.content_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create index question_reviews_question_type_created_idx
  on private.question_reviews(question_id, review_type, created_at desc);
create index question_reviews_reviewer_idx
  on private.question_reviews(reviewer_id, created_at desc);
create index import_batches_created_by_idx
  on private.import_batches(created_by, created_at desc);
create index import_rows_batch_status_idx
  on private.import_rows(batch_id, status, row_number);
create index content_audit_entity_idx
  on private.content_audit_log(entity_type, entity_id, created_at desc);
create index content_audit_actor_idx
  on private.content_audit_log(actor_user_id, created_at desc);

create or replace function private.question_content_fingerprint(question_stem text, question_options jsonb)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select encode(
    extensions.digest(
      convert_to(
        lower(regexp_replace(trim(question_stem), '\s+', ' ', 'g')) || '|' || question_options::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function private.set_question_content_fingerprint()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.content_fingerprint := private.question_content_fingerprint(new.stem, new.options);
  return new;
end;
$$;

create trigger set_question_content_fingerprint
before insert or update of stem, options on public.questions
for each row execute function private.set_question_content_fingerprint();

update public.questions
set content_fingerprint = private.question_content_fingerprint(stem, options)
where content_fingerprint is null;

alter table public.questions alter column content_fingerprint set not null;
create index questions_content_fingerprint_idx on public.questions(content_fingerprint);
create index questions_status_subject_topic_idx on public.questions(status, subject_id, topic_id);
create index questions_source_status_idx on public.questions(source_id, status);

insert into private.question_source_governance(source_id)
select id from public.question_sources
on conflict (source_id) do nothing;

insert into private.question_governance(question_id)
select id from public.questions
on conflict (question_id) do nothing;

alter table public.cognitive_levels enable row level security;
alter table public.clinical_tasks enable row level security;
alter table private.question_source_governance enable row level security;
alter table private.question_governance enable row level security;
alter table private.question_reviews enable row level security;
alter table private.import_batches enable row level security;
alter table private.import_rows enable row level security;
alter table private.content_audit_log enable row level security;

revoke all on public.cognitive_levels, public.clinical_tasks from anon, authenticated;
grant select on public.cognitive_levels, public.clinical_tasks to authenticated;
grant all on public.cognitive_levels, public.clinical_tasks to service_role;

create policy cognitive_levels_read_authenticated
on public.cognitive_levels for select to authenticated
using (is_active);

create policy clinical_tasks_read_authenticated
on public.clinical_tasks for select to authenticated
using (is_active);

revoke all on private.question_source_governance, private.question_governance, private.question_reviews,
  private.import_batches, private.import_rows, private.content_audit_log
from public, anon, authenticated;

grant all on private.question_source_governance, private.question_governance, private.question_reviews,
  private.import_batches, private.import_rows, private.content_audit_log
to service_role;

grant usage, select on all sequences in schema private to service_role;

-- Extend the M2 immutability boundary so M4 governance fields cannot be altered
-- in-place after a revision becomes published/quarantined/archived.
create or replace function private.protect_published_question_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('published','quarantined','archived') then
      raise exception 'published question revisions cannot be deleted';
    end if;
    return old;
  end if;

  if old.status in ('published','quarantined','archived') then
    if row(
      new.id,
      new.revision_group_id,
      new.revision_number,
      new.supersedes_question_id,
      new.subject_id,
      new.topic_id,
      new.source_id,
      new.stem,
      new.options,
      new.cognitive_level,
      new.clinical_task,
      new.risk_tier,
      new.content_fingerprint,
      new.random_bucket,
      new.published_at,
      new.created_at
    ) is distinct from row(
      old.id,
      old.revision_group_id,
      old.revision_number,
      old.supersedes_question_id,
      old.subject_id,
      old.topic_id,
      old.source_id,
      old.stem,
      old.options,
      old.cognitive_level,
      old.clinical_task,
      old.risk_tier,
      old.content_fingerprint,
      old.random_bucket,
      old.published_at,
      old.created_at
    ) then
      raise exception 'published question content is immutable; create a new revision instead';
    end if;

    if new.status not in ('published','quarantined','archived') then
      raise exception 'published question status may only remain published or move to quarantined/archived';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function private.question_content_fingerprint(text, jsonb) from public, anon, authenticated;
revoke execute on function private.set_question_content_fingerprint() from public, anon, authenticated;
revoke execute on function private.protect_published_question_revision() from public, anon, authenticated;
