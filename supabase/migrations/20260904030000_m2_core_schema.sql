create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create type public.session_mode as enum ('study','diagnostic','practice_mock','realistic_exam');
create type public.session_status as enum ('created','active','submitted','abandoned','expired');
create type public.question_status as enum ('draft','review','published','quarantined','archived');
create type public.report_status as enum ('open','triaged','resolved','dismissed');
create type public.mastery_state as enum ('unseen','learning','weak','developing','strong','mastered','review_due');
create type private.staff_role as enum ('content_editor','clinical_reviewer','item_reviewer','content_admin','support_admin','super_admin');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.programmes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete restrict,
  code text not null,
  name text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(programme_id, code)
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete restrict,
  parent_topic_id uuid references public.topics(id) on delete restrict,
  code text not null,
  name text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(subject_id, code),
  check (parent_topic_id is null or parent_topic_id <> id)
);

create table public.question_sources (
  id uuid primary key default gen_random_uuid(),
  source_class text not null check (source_class in ('verified_past_question','reported_past_question','licensed_question','radicx_original','radicx_clinical_scenario','ai_assisted_draft')),
  label text not null,
  public_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  revision_group_id uuid not null default gen_random_uuid(),
  revision_number integer not null default 1 check (revision_number > 0),
  supersedes_question_id uuid references public.questions(id) on delete restrict,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  topic_id uuid references public.topics(id) on delete restrict,
  source_id uuid references public.question_sources(id) on delete set null,
  status public.question_status not null default 'draft',
  stem text not null check (char_length(stem) > 0),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 10),
  cognitive_level text,
  clinical_task text,
  random_bucket smallint not null default (floor(random() * 100)::smallint) check (random_bucket between 0 and 99),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(revision_group_id, revision_number),
  check ((status = 'published' and published_at is not null) or status <> 'published')
);

create table private.question_keys (
  question_id uuid primary key references public.questions(id) on delete restrict,
  correct_option smallint not null check (correct_option between 0 and 9),
  explanation_private text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.staff_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role private.staff_role not null,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(user_id, role)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode public.session_mode not null,
  status public.session_status not null default 'created',
  current_question_id uuid references public.questions(id) on delete restrict,
  device_version integer not null default 1 check (device_version > 0),
  started_at timestamptz,
  submitted_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id, user_id),
  check ((status = 'submitted' and submitted_at is not null) or status <> 'submitted')
);

create table public.session_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  selected_option smallint check (selected_option between 0 and 9),
  confidence smallint check (confidence between 1 and 5),
  flagged boolean not null default false,
  operation_id uuid not null default gen_random_uuid(),
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(session_id, user_id) references public.sessions(id, user_id) on delete cascade,
  unique(session_id, question_id),
  unique(operation_id)
);

create table public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  readiness_score numeric(5,2) check (readiness_score is null or readiness_score between 0 and 100),
  evidence_strength numeric(5,2) check (evidence_strength is null or evidence_strength between 0 and 100),
  meaningful_learning_days integer not null default 0 check (meaningful_learning_days >= 0),
  updated_at timestamptz not null default now()
);

create table public.user_question_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  mastery_state public.mastery_state not null default 'unseen',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  correct_count integer not null default 0 check (correct_count >= 0 and correct_count <= attempt_count),
  last_attempt_at timestamptz,
  next_review_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(user_id, question_id)
);

create table public.user_subject_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  attempts integer not null default 0 check (attempts >= 0),
  correct integer not null default 0 check (correct >= 0 and correct <= attempts),
  mastery_score numeric(5,2) check (mastery_score is null or mastery_score between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key(user_id, subject_id)
);

create table public.user_topic_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  attempts integer not null default 0 check (attempts >= 0),
  correct integer not null default 0 check (correct >= 0 and correct <= attempts),
  mastery_score numeric(5,2) check (mastery_score is null or mastery_score between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key(user_id, topic_id)
);

create table public.bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, question_id)
);

create table public.question_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  category text not null check (category in ('incorrect','ambiguous','outdated','typo','other')),
  details text check (details is null or char_length(details) <= 2000),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(user_id, display_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
