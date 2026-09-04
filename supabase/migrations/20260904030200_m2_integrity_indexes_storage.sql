alter table public.topics add constraint topics_id_subject_unique unique(id, subject_id);
alter table public.topics drop constraint topics_parent_topic_id_fkey;
alter table public.topics add constraint topics_parent_same_subject_fk foreign key(parent_topic_id, subject_id) references public.topics(id, subject_id) on delete restrict;
alter table public.questions add constraint questions_topic_same_subject_fk foreign key(topic_id, subject_id) references public.topics(id, subject_id) on delete restrict;

create or replace function private.validate_question_key()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare option_count integer;
begin
  select jsonb_array_length(q.options) into option_count from public.questions q where q.id = new.question_id;
  if option_count is null or new.correct_option >= option_count then
    raise exception 'correct_option must reference an existing question option';
  end if;
  return new;
end;
$$;
create trigger validate_question_key before insert or update on private.question_keys for each row execute function private.validate_question_key();
revoke execute on function private.validate_question_key() from public, anon, authenticated;

create index subjects_programme_idx on public.subjects(programme_id, sort_order);
create index topics_subject_parent_idx on public.topics(subject_id, parent_topic_id, sort_order);
create index questions_subject_status_bucket_idx on public.questions(subject_id, status, random_bucket);
create index questions_topic_status_bucket_idx on public.questions(topic_id, status, random_bucket) where topic_id is not null;
create index questions_revision_group_idx on public.questions(revision_group_id, revision_number desc);
create index sessions_user_status_activity_idx on public.sessions(user_id, status, last_activity_at desc);
create index session_answers_session_question_idx on public.session_answers(session_id, question_id);
create index user_question_state_review_idx on public.user_question_state(user_id, next_review_at) where next_review_at is not null;
create index user_subject_stats_owner_idx on public.user_subject_stats(user_id, subject_id);
create index user_topic_stats_owner_idx on public.user_topic_stats(user_id, topic_id);
create index question_reports_question_status_idx on public.question_reports(question_id, status, created_at desc);
create index question_reports_user_created_idx on public.question_reports(user_id, created_at desc);

alter table storage.objects enable row level security;

create policy question_media_read_authenticated on storage.objects for select to authenticated using (bucket_id = 'question-media');

-- Source evidence and administrative uploads intentionally receive no browser policies in M2.
-- Their buckets remain private and server/staff access is added only through trusted M4+ workflows.
