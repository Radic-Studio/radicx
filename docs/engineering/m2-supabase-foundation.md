# M2 Supabase Core & Security Foundation

Status: in progress

## Scope

M2 establishes the Supabase development/staging foundation for RadicX without implementing M3 UI or later product workflows. Supabase is the production authority for Auth, PostgreSQL, Storage, RLS and durable backend state. Hatchable is not used as a competing database or authentication system.

## Environments

- Local: Supabase CLI, Docker, synthetic data only.
- CI: clean ephemeral local Supabase stack, migrations + seed + pgTAP tests.
- Staging: hosted Supabase project, synthetic or sanitized data only.
- Production: intentionally not provisioned in M2.

`RadicX Staging` is provisioned and healthy. Supabase reports its actual hosted region as `eu-west-1` (West Europe / Ireland). The project requirement is to use a defensible European region for Nigerian users; this placement does not by itself establish Nigerian field latency, which must be measured later on representative devices/networks.

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

The `private` schema is denied to `anon` and `authenticated`. Browser roles receive no direct answer-key or staff-role privileges. Both private tables also have RLS enabled with no browser policies, adding a fail-closed defense-in-depth layer if future grants or API exposure are ever misconfigured. Trusted server operations use service-side credentials/functions only.

## RLS model

All exposed public tables have RLS enabled. Sensitive private tables also have RLS enabled without browser policies.

Student-owned tables use `auth.uid()` ownership policies. Derived learning/readiness tables are readable by their owner but not directly writable by students because correctness, mastery, readiness and related derived values remain server-authoritative.

Curriculum is authenticated read-only. Published questions are authenticated read-only. `question_sources` intentionally has no browser grant in M2.

`bookmarks` permit owner read/create/delete. `question_reports` permit owner read/create only; report status remains trusted/admin-managed.

Cross-user hosted checks verify that Student A cannot read or update Student B records, anonymous users cannot read profiles, students cannot read `private.question_keys`, and students cannot insert staff roles.

## Staff authorization and MFA architecture

`private.staff_roles` contains the approved staff-role set: content editor, clinical reviewer, item reviewer, content admin, support admin and super admin.

`private.has_staff_role()` is a server-only helper and can require an `aal2` JWT before returning staff authorization. M2 establishes this architecture; complete admin MFA enforcement and admin surfaces remain later milestones.

## Auth foundation

Local configuration enables email/password sign-up, requires email confirmation, supports password recovery-compatible redirects, and leaves phone sign-up disabled. TOTP enrollment/verification is enabled for MFA readiness.

Google OAuth remains readiness-only until provider credentials and approved redirect URLs are configured. CAPTCHA/bot protection is also a hosted-environment configuration task; no CAPTCHA secret belongs in browser source or Git history. Production custom SMTP is deferred to publishing work, while M2 remains compatible with it.

The connected Supabase management interface does not expose hosted Auth settings for direct verification. Hosted Auth configuration therefore requires one final dashboard validation before M2 acceptance.

## Storage foundation

Hosted private buckets:

- `question-media`: student-safe question media. Private by default; authenticated reads are allowed through Storage RLS when content is intentionally delivered.
- `source-evidence`: restricted provenance/source evidence. No browser policy in M2.
- `admin-uploads`: protected administrative imports. No browser policy in M2.

Hosted validation confirms all three buckets are private and carry the intended size/MIME restrictions. `source-evidence` and `admin-uploads` have no browser policies.

Source scans and restricted evidence must never be made public. Storage metadata is controlled through Supabase and RLS; object operations should use the Storage API rather than direct manipulation of `storage.objects` metadata.

## Index rationale

Indexes target expected access paths rather than indexing every column mechanically. They cover curriculum traversal, question selection/revisions, session ownership, review scheduling, report triage, and foreign-key paths identified by Performance Advisor.

Performance Advisor's unindexed-foreign-key notices were remediated by `20260904054500_m2_advisor_indexes.sql`. Remaining unused-index notices are informational on a newly provisioned, low-traffic staging database and are not evidence that the indexes should be removed before representative workloads exist.

## Key strategy

Browser code uses only the project URL and current Supabase publishable key (`sb_publishable_...`). Secret keys, legacy service-role credentials, database passwords, private answer data and privileged admin credentials must never be committed or exposed to the browser.

## Testing and CI

`.github/workflows/database.yml` starts a clean local Supabase stack, resets from migrations + seed, runs database lint, executes pgTAP tests, and verifies TypeScript type generation. Generated types are uploaded as a short-lived CI artifact until an application layer consumes them; M2 does not commit unused generated application types merely for ceremony.

A passing test against manually modified hosted state is not acceptance evidence. M2 tests must pass after a clean reset.

## Hosted staging validation status

Completed:

1. repository migrations applied in order;
2. synthetic M2 seed fixtures loaded;
3. modern publishable-key availability confirmed without exposing privileged keys;
4. private buckets and Storage policies verified;
5. cross-user authorization/security checks passed;
6. generated TypeScript types verified;
7. Security Advisor reviewed;
8. Performance Advisor reviewed and foreign-key findings remediated;
9. private answer-key and staff-role RLS defense-in-depth enabled after explicit approval.

Remaining before M2 acceptance: hosted Auth dashboard settings verification and a green final CI/regression run on the latest branch head.
