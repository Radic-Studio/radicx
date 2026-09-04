-- M2 hosted advisor remediation: add covering indexes for foreign keys used by
-- ownership, revision, curriculum and review workflows.

create index staff_roles_granted_by_idx
  on private.staff_roles(granted_by)
  where granted_by is not null;

create index bookmarks_question_idx
  on public.bookmarks(question_id);

create index questions_source_idx
  on public.questions(source_id)
  where source_id is not null;

create index questions_supersedes_idx
  on public.questions(supersedes_question_id)
  where supersedes_question_id is not null;

create index questions_topic_subject_fk_idx
  on public.questions(topic_id, subject_id)
  where topic_id is not null;

create index session_answers_question_idx
  on public.session_answers(question_id);

create index session_answers_session_user_idx
  on public.session_answers(session_id, user_id);

create index session_answers_user_idx
  on public.session_answers(user_id);

create index sessions_current_question_idx
  on public.sessions(current_question_id)
  where current_question_id is not null;

create index topics_parent_subject_fk_idx
  on public.topics(parent_topic_id, subject_id)
  where parent_topic_id is not null;

create index user_question_state_question_idx
  on public.user_question_state(question_id);

create index user_subject_stats_subject_idx
  on public.user_subject_stats(subject_id);

create index user_topic_stats_topic_idx
  on public.user_topic_stats(topic_id);
