# Supabase Index Rationale

M2 adds indexes only for expected access patterns not already covered by primary-key or unique indexes.

- `subjects_programme_idx`: ordered subject navigation within a programme.
- `topics_subject_parent_idx`: hierarchical topic traversal and ordered children.
- `questions_subject_status_bucket_idx`: eligible question selection by subject/status with random-bucket foundation.
- `questions_topic_status_bucket_idx`: topic-specific eligible question selection.
- `sessions_user_status_activity_idx`: resume/recent-session queries by owner and status.
- `user_question_state_review_idx`: due-review scheduling by owner/time.
- `question_reports_question_status_idx`: content-report triage by question/status/age.
- `question_reports_user_created_idx`: user report history.

No separate indexes duplicate `profiles(user_id)`, `session_answers(session_id, question_id)`, `bookmarks(user_id, question_id)`, or subject/topic stats ownership because their primary/unique constraints already create suitable B-tree indexes.
