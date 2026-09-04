# M2 Acceptance Evidence

Status: ACCEPTED

This record follows the required lifecycle: SPECIFY -> BUILD -> TEST -> FIX -> RETEST -> REGRESSION -> STAGING VALIDATION -> ACCEPT.

## Build evidence

- Working branch: `feat/m2-supabase-core-security`
- Base/integration branch: `staging`
- Pull request: #13
- Production project: not created in M2.
- Hosted staging project: `RadicX Staging`, project ref `bhcmfqabwvjawengpxvs`, status `ACTIVE_HEALTHY`.
- Actual hosted region: `eu-west-1` (West Europe / Ireland).
- Hosted data: synthetic M2 fixtures only.

## Implemented M2 scope

- migration-driven Supabase foundation under `supabase/migrations/`;
- core identity, curriculum, question, session, progress, bookmark and report schema;
- private `question_keys` and `staff_roles` domain;
- explicit grants and RLS for browser-exposed tables;
- defense-in-depth RLS on private answer-key/staff-role tables with no browser policies;
- published-question revision immutability;
- ownership/integrity constraints and targeted indexes;
- private Storage buckets and access-policy foundation;
- deterministic synthetic seed;
- pgTAP database/security coverage;
- database CI with clean reset, lint, tests and generated TypeScript types;
- hosted Auth configuration/readiness validation.

## Test / fix / retest evidence

The first database test run exposed a pgTAP harness defect in the cross-user UPDATE assertion. The test was corrected and retested successfully.

Hosted Performance Advisor then identified missing foreign-key covering indexes. Migration `20260904054500_m2_advisor_indexes.sql` remediated those findings. After explicit user approval, migration `20260904054800_m2_private_table_rls.sql` enabled RLS on `private.question_keys` and `private.staff_roles`.

A later Database CI attempt failed before migrations because a GitHub-hosted runner already had Supabase's local port `54322` occupied. The failed job was rerun on a clean runner and passed without code/schema changes, confirming an infrastructure collision rather than a RadicX defect.

Latest fully validated M2 regression before acceptance documentation:

- application/M1 `CI / verify`: PASS;
- Database CI: PASS;
- clean `supabase start`: PASS;
- clean `supabase db reset`: PASS with all six M2 migrations and synthetic seed;
- private Storage bucket seeding: PASS;
- `supabase db lint --local --level warning`: PASS with no schema errors;
- pgTAP: PASS, 4 files / 45 tests;
- TypeScript type generation: PASS;
- generated-types artifact upload: PASS.

## Hosted staging validation

Repository migrations applied to hosted staging:

1. `m2_core_schema`
2. `m2_security_rls`
3. `m2_integrity_indexes_storage`
4. `m2_published_question_immutability`
5. `m2_advisor_indexes`
6. `m2_private_table_rls`

Hosted transactional synthetic-user checks passed:

- Student A sees only Student A's session and profile;
- Student A cannot update Student B's session;
- authenticated browser role cannot read private answer keys;
- authenticated browser role cannot insert private staff roles;
- anonymous profile access is denied;
- protected profile columns cannot be updated by a student;
- duplicate `(session_id, question_id)` answers are rejected.

Hosted Storage validation confirms all three intended buckets are private with the intended size/MIME restrictions.

## Hosted Auth validation

Dashboard validation confirmed:

- signup enabled;
- anonymous sign-in disabled;
- email provider enabled;
- email confirmation enabled;
- secure email change enabled;
- secure password change enabled during guided validation;
- phone provider disabled;
- Google provider left disabled/unconfigured but ready for the later auth milestone;
- TOTP MFA enabled;
- AAL1 session-duration limiting enabled;
- SMS MFA disabled;
- Site URL remains `http://localhost:3000` while the real auth UI is not yet implemented;
- redirect allow-list is empty with no unsafe wildcard;
- CAPTCHA is available/configurable but intentionally not activated in M2;
- custom SMTP remains deferred to its approved later milestone.

## Advisor result

Final Security Advisor review has no critical/high M2 issue. The only notices are INFO-level `RLS Enabled No Policy` findings for `private.question_keys`, `private.staff_roles`, and `public.question_sources`; these are deliberate fail-closed states.

Final Performance Advisor review has no unindexed-foreign-key findings. Remaining INFO-level unused-index notices are expected on the fresh, near-empty staging database and are retained until representative workload evidence exists.

## Acceptance checklist

- [x] M1 inspected; no blocking M1 defect found.
- [x] Migrations/seed/tests created and version controlled.
- [x] Core schema and private domains hosted.
- [x] RLS/explicit grants implemented and tested.
- [x] Cross-user authorization tests pass.
- [x] Private answer-key/staff-role isolation passes.
- [x] Published-question revision integrity passes.
- [x] Storage foundation hosted and validated.
- [x] Targeted indexes implemented and advisor findings remediated.
- [x] Clean reset/lint/pgTAP/type-generation CI passes.
- [x] Application/M1 regression passes.
- [x] Hosted Auth configuration/readiness verified.
- [x] Security Advisor reviewed with no blocking finding.
- [x] Performance Advisor reviewed with no blocking finding.
- [x] Staging validation completed.
- [x] M2 accepted.

Detailed hosted evidence: `docs/engineering/m2-hosted-validation.md`.

M2 is accepted. The PR may be integrated through the protected `staging` flow after its final documentation-head checks pass. Do not begin or include M3 work in this PR.
