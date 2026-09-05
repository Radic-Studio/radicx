-- M6 hosted Performance Advisor follow-up.
-- Cover Study foreign keys used by scoped session/filter operations without changing behavior.

create index sessions_study_subject_id_idx
  on public.sessions(study_subject_id)
  where study_subject_id is not null;

create index sessions_study_topic_id_idx
  on public.sessions(study_topic_id)
  where study_topic_id is not null;

create index study_session_items_session_user_idx
  on public.study_session_items(session_id, user_id);
