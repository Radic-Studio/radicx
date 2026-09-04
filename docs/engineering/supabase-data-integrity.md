# Supabase Data Integrity Guarantees

M2 enforces important rules in PostgreSQL rather than relying only on application code.

- Every student-owned row references an Auth user.
- Curriculum subjects belong to a programme; nested topics cannot cross subjects.
- Questions reference valid subject/topic combinations.
- Question revisions have unique `(revision_group_id, revision_number)` identities.
- Published question content cannot be mutated or deleted; corrections require new revisions.
- Private answer-key indexes must point to an existing option.
- A session answer belongs to the same user as its session.
- Only one answer row may exist per `(session_id, question_id)`.
- `operation_id` is unique for idempotency foundations.
- Attempt/correct counters and readiness/mastery values have range constraints.
- Submitted sessions require a submission timestamp.

Later milestones may add new constraints as their behavior becomes concrete, but they must preserve these foundations.
