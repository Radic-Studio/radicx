# Supabase Schema Overview

## Public browser-safe foundation

`profiles` maps one profile to one Supabase Auth user.

`programmes -> subjects -> topics` forms the curriculum hierarchy. `topics.parent_topic_id` supports nested topics, with database constraints preventing cross-subject parentage.

`question_sources` and `questions` establish content provenance and revision foundations. `question_sources` is not browser-granted in M2. Questions expose no answer key.

`sessions` and `session_answers` establish durable student session state. Session answers have a unique `(session_id, question_id)` constraint and idempotency `operation_id`.

`user_progress`, `user_question_state`, `user_subject_stats`, and `user_topic_stats` establish server-authoritative learning summaries. Students can read only their own summaries and cannot write derived values directly.

`bookmarks` and `question_reports` provide student utility foundations with owner-scoped RLS.

## Private foundation

`private.question_keys` stores the correct option and private explanation for each question revision. A trigger verifies that the correct-option index exists in the question's option array.

`private.staff_roles` stores authoritative staff-role assignments. No student/browser write grant exists.

## Revision durability

A question revision is identified by its own immutable `id` plus `revision_group_id` and `revision_number`. `supersedes_question_id` links revisions. Published/quarantined/archived revision content cannot be mutated or deleted; corrections require a new revision. Session answers therefore remain linked to the exact content the learner saw.
