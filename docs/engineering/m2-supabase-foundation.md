# M2 Supabase Core & Security Foundation

Status: in progress

## Scope

M2 establishes the Supabase development/staging foundation for RadicX without implementing M3 UI or later product workflows. Supabase is the production authority for Auth, PostgreSQL, Storage, RLS and durable backend state. Hatchable is not used as a competing database or authentication system.

## Environments

- Local: Supabase CLI, Docker, synthetic data only.
- CI: clean ephemeral local Supabase stack, migrations + seed + pgTAP tests.
- Staging: hosted Supabase project, synthetic or sanitized data only.
- Production: intentionally not provisioned in M2.

The initial hosted staging target is London (`eu-west-2`). This is a defensible European starting region for Nigerian users, not proof of field latency. Nigerian network/device benchmarking remains a later acceptance activity.

## Migration architecture

All database structure is version controlled in `supabase/migrations/`. Important schema changes must never exist only in the hosted dashboard.

Local reset:

```bash
supabase start
supabase db reset
supabase test db
supabase db lint --local --level warning
```

`supabase/seed.sql` contains reproducible synthetic curriculum/question fixtures. It contains no real student PII.

## Schema overview

### Browser-safe domain (`public`)

Identity: `profiles`

Curriculum: `programmes`, `subjects`, `topics`

Content foundation: `question_sources`, `questions`

Sessions: `sessions`, `session_answers`

Learning: `user_progress`, `user_question_state`, `user_subject_stats`, `user_topic_stats`

Utilities: `bookmarks`, `question_reports`

`topics.parent_topic_id` supports recursive topic hierarchy while a composite foreign key prevents a child topic from referencing a parent in another subject. Questions preserve immutable-revision foundations through `revision_group_id`, `revision_number`, and `supersedes_question_id`; session answers reference the exact question revision used.

### Private domain (`private`)

`question_keys` stores correct answer positions and private explanations.

`staff_roles` stores authoritative staff authorization. Staff authority is not read from user-editable Auth metadata.

The `private` schema is denied to `anon` and `authenticated`. Browser roles receive no direct answer-key or staff-role privileges. Trusted server operations use service-side credentials/functions only.

## RLS model

All exposed tables have RLS enabled.

Student-owned tables use `auth.uid()` ownership policies. Derived learning/readiness tables are readable by their owner but not directly writable by students because correctness, mastery, readiness and related derived values remain server-authoritative.

Curriculum is authenticated read-only. Published questions are authenticated read-only. `question_sources` intentionally has no browser grant in M2.

`bookmarks` permit owner read/create/delete. `question_reports` permit owner read/create only; report status remains trusted/admin-managed.

Cross-user tests verify that Student A cannot read or update Student B records, anonymous users cannot read profiles, students cannot read `private.question_keys`, and students cannot insert staff roles.

## Staff authorization and MFA architecture

`private.staff_roles` contains the approved staff-role set: content editor, clinical reviewer, item reviewer, content admin, support admin and super admin.

`private.has_staff_role()` is a server-only helper and can require an `aal2` JWT before returning staff authorization. M2 establishes this architecture; complete admin MFA enforcement and admin surfaces remain later milestones.

## Auth foundation

Local configuration enables email/password sign-up, requires email confirmation, supports password recovery-compatible redirects, and leaves phone sign-up disabled. TOTP enrollment/verification is enabled for MFA readiness.

Google OAuth remains readiness-only until provider credentials and approved redirect URLs are configured. CAPTCHA/bot protection is also a hosted-environment configuration task; no CAPTCHA secret belongs in browser source or Git history. Production custom SMTP is deferred to publishing work, while M2 remains compatible with it.

## Storage foundation

Declared private buckets:

- `question-media`: student-safe question media. Private by default; authenticated reads are allowed through Storage RLS when content is intentionally delivered.
- `source-evidence`: restricted provenance/source evidence. No browser policy in M2.
- `admin-uploads`: protected administrative imports. No browser policy in M2.

Source scans and restricted evidence must never be made public. Storage metadata is controlled through Supabase and RLS; object operations should use the Storage API rather than direct manipulation of `storage.objects` metadata.

## Index rationale

Indexes target expected access paths rather than indexing every foreign key mechanically:

- subjects by programme/order;
- topics by subject/parent/order;
- published question selection by subject/topic/status/random bucket;
- question revision lookup;
- active/recent sessions by owner/status/activity;
- due-review lookup for `user_question_state`;
- report triage by question/status/time.

Primary-key/unique indexes already cover `profiles(user_id)`, `bookmarks(user_id, question_id)`, session-answer uniqueness and subject/topic summary ownership; duplicate indexes are intentionally avoided.

## Key strategy

Browser code uses only the project URL and current Supabase publishable key (`sb_publishable_...`). Secret keys, legacy service-role credentials, database passwords, private answer data and privileged admin credentials must never be committed or exposed to the browser.

## Testing and CI

`.github/workflows/database.yml` starts a clean local Supabase stack, resets from migrations + seed, runs database lint, executes pgTAP tests, and verifies TypeScript type generation. Generated types are uploaded as a short-lived CI artifact until the first verified hosted/local generation is committed and consistency enforcement is enabled.

A passing test against manually modified hosted state is not acceptance evidence. M2 tests must pass after a clean reset.

## Hosted staging validation checklist

After project provisioning is available:

1. apply repository migrations in order;
2. load only synthetic M2 seed fixtures;
3. verify email confirmation and recovery configuration;
4. verify phone auth remains disabled;
5. obtain/use a modern publishable key only in browser configuration;
6. verify private buckets and storage policies;
7. run cross-user authorization/security tests;
8. generate and commit TypeScript database types;
9. run Security Advisor and Performance Advisor;
10. resolve M2-relevant critical/high findings before acceptance.
