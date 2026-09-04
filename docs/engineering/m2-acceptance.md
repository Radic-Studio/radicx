# M2 Acceptance Evidence

Status: IN PROGRESS — hosted Auth dashboard verification remains

This record is updated as M2 proceeds through SPECIFY -> BUILD -> TEST -> FIX -> RETEST -> REGRESSION -> STAGING VALIDATION -> ACCEPT.

## Build evidence

- Working branch: `feat/m2-supabase-core-security`
- Base/integration branch: `staging`
- Pull request: #13
- Production project: not created in M2.
- Hosted development/staging project: `RadicX Staging`, project ref `bhcmfqabwvjawengpxvs`, status `ACTIVE_HEALTHY`.
- Actual hosted region reported by Supabase: `eu-west-1` (West Europe / Ireland). The approved architecture requires a European region; no latency claim is made.
- Hosted data: synthetic M2 fixtures only.

## Test / fix / retest evidence

Initial Database CI successfully started Supabase, rebuilt the database from the M2 migrations, seeded synthetic data and private Storage buckets, and passed database lint. The first pgTAP run exposed a test-harness SQL defect in the cross-user UPDATE assertion. The test was corrected and retested.

Retest on commit `dffa84df104360992939f09b692a2ca74b67ef34` passed the original M2 foundation: existing M1 `CI / verify`, clean Supabase start/reset, private bucket creation, database lint, 3 pgTAP files / 30 tests, generated TypeScript types and the existing application regression gate.

Hosted Performance Advisor then identified unindexed foreign keys. Migration `20260904054500_m2_advisor_indexes.sql` was added and applied to staging. A follow-up advisor run confirms the unindexed-foreign-key findings are resolved. Remaining unused-index notices are informational and expected on a new low-traffic staging database.

After explicit user approval, migration `20260904054800_m2_private_table_rls.sql` enabled RLS on `private.question_keys` and `private.staff_roles` with no browser policies. Hosted verification confirms RLS is enabled on both tables, and authenticated browser-role access continues to fail with SQLSTATE 42501. `001_schema_integrity.sql` now asserts both private tables have RLS enabled.

Final regression on branch head `1c536d703e07ac1111ba29f39d5268ba16276d25` passed:

- `CI` run 38: PASS;
- `Database` run 15: PASS;
- clean `supabase start`: PASS;
- clean `supabase db reset`: PASS with all six M2 migrations and synthetic seed;
- declared private Storage bucket creation/update: PASS;
- `supabase db lint --local --level warning`: PASS, no schema errors;
- pgTAP: PASS, 4 files / 45 tests;
- TypeScript type generation: PASS;
- generated-types artifact upload: PASS.

The generated-types workflow proves clean generation from the migration-defined database. Committing generated application types remains deferred until an application layer consumes them.

## Hosted validation evidence

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

All test users/records used for hosted authorization checks were rolled back.

Hosted Storage validation confirms three private buckets with the intended size/MIME restrictions. `question-media` has authenticated-read policy foundation. `source-evidence` and `admin-uploads` have no browser policies.

Security Advisor has no critical/high M2 finding. It reports informational `RLS Enabled No Policy` notices for `private.question_keys`, `private.staff_roles`, and `public.question_sources`. These are intentional fail-closed states: browser access is not granted to these tables in M2.

Performance Advisor has no remaining unindexed-foreign-key finding after remediation. Remaining unused-index notices are informational on a fresh staging database and are deferred until representative query workloads exist.

## Acceptance checks

- [x] M1 inspected; no blocking M1 defect found.
- [x] Migration architecture added under `supabase/migrations/`.
- [x] Core schema authored and hosted.
- [x] Private question-key and staff-role domain authored and hosted.
- [x] RLS and explicit browser grants authored for exposed public tables.
- [x] Private answer-key and staff-role RLS defense-in-depth enabled after explicit approval.
- [x] Targeted indexes authored.
- [x] Synthetic seed authored and loaded to staging.
- [x] pgTAP schema/security tests authored.
- [x] Database CI workflow authored.
- [x] Clean CI database reset succeeds on latest M2 branch head.
- [x] Database lint passes with no schema errors on latest M2 branch head.
- [x] pgTAP passes on latest M2 branch head (4 files / 45 tests).
- [x] Generated TypeScript type workflow succeeds from clean schema.
- [x] Application/M1 regression `CI / verify` passes on latest M2 branch head.
- [x] Hosted staging project provisioned.
- [x] Repository migrations applied to hosted staging.
- [x] Hosted cross-user/security validation performed.
- [x] Storage hosted-staging validation performed.
- [x] Security Advisor reviewed; only intentional informational no-policy findings remain.
- [x] Performance Advisor reviewed; unindexed-FK findings remediated, fresh-database unused-index notices documented.
- [ ] Hosted Auth dashboard settings verified (connector cannot read/write these settings).
- [ ] Staging validation completed.
- [ ] M2 accepted.

Detailed hosted evidence: `docs/engineering/m2-hosted-validation.md`.

No item is marked complete merely because SQL/code exists. M2 remains open only because hosted Auth configuration still requires Dashboard verification. Do not begin M3 before that validation is completed.
