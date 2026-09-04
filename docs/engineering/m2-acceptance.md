# M2 Acceptance Evidence

Status: IN PROGRESS — hosted staging active; one defense-in-depth approval and Auth dashboard verification remain

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

Retest on commit `dffa84df104360992939f09b692a2ca74b67ef34` passed:

- existing M1 `CI / verify`: PASS;
- clean `supabase start`: PASS;
- `supabase db reset`: PASS;
- declared private Storage bucket creation: PASS;
- `supabase db lint --local --level warning`: PASS, no schema errors;
- pgTAP: PASS, 3 files / 30 tests;
- generated TypeScript types: PASS and uploaded as CI artifact `database-generated-types`;
- repository secret scan/build regression: PASS through existing `verify` gate.

Hosted Performance Advisor then identified unindexed foreign keys. Migration `20260904054500_m2_advisor_indexes.sql` was added and applied to staging. A follow-up advisor run confirms the unindexed-foreign-key findings are resolved. Remaining unused-index notices are informational and expected on a new low-traffic staging database.

A fourth pgTAP file now verifies the advisor-remediation indexes. CI/regression is rerunning against the latest branch state.

The generated-types artifact proves clean generation from the migration-defined database. Committing generated application types is intentionally deferred until an application layer consumes them; M2 does not create an unused frontend dependency merely to satisfy file-count theater.

## Hosted validation evidence

Repository migrations applied to hosted staging:

1. `m2_core_schema`
2. `m2_security_rls`
3. `m2_integrity_indexes_storage`
4. `m2_published_question_immutability`
5. `m2_advisor_indexes`

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

Security Advisor reports only an informational no-policy notice for `public.question_sources`; this is intentional because M2 grants no browser access to that table.

A separate schema inspection raised a defense-in-depth warning because RLS is disabled on `private.question_keys` and `private.staff_roles`. Those tables are already inaccessible to browser roles because the `private` schema is not exposed and `anon`/`authenticated` privileges are revoked; hosted permission tests confirm denial. Enabling RLS with no browser policies would add another fail-closed layer. The inspection tool explicitly requires user approval before applying that remediation, so this remains pending and is not being silently ignored.

## Acceptance checks

- [x] M1 inspected; no blocking M1 defect found.
- [x] Migration architecture added under `supabase/migrations/`.
- [x] Core schema authored and hosted.
- [x] Private question-key and staff-role domain authored and hosted.
- [x] RLS and explicit browser grants authored for exposed public tables.
- [x] Targeted indexes authored.
- [x] Synthetic seed authored and loaded to staging.
- [x] pgTAP schema/security tests authored.
- [x] Database CI workflow authored.
- [x] Clean CI database reset succeeds on the tested M2 foundation.
- [x] pgTAP baseline tests pass (30/30); latest advisor-index regression rerun pending.
- [x] Database lint passes with no schema errors.
- [x] Generated TypeScript type workflow succeeds from clean schema.
- [x] Application/M1 regression `verify` gate passed on tested M2 state; latest rerun pending.
- [x] Hosted staging project provisioned.
- [x] Repository migrations applied to hosted staging.
- [x] Hosted cross-user/security validation performed.
- [x] Storage hosted-staging validation performed.
- [x] Security Advisor reviewed; only intentional informational finding remains.
- [x] Performance Advisor reviewed; unindexed-FK findings remediated, fresh-database unused-index notices documented.
- [ ] Private-table RLS defense-in-depth remediation decision completed.
- [ ] Hosted Auth dashboard settings verified (connector cannot read/write these settings).
- [ ] Latest CI/regression rerun completed after advisor remediation/docs changes.
- [ ] Staging validation completed.
- [ ] M2 accepted.

Detailed hosted evidence: `docs/engineering/m2-hosted-validation.md`.

No item is marked complete merely because SQL/code exists. M2 remains open until the remaining security decision, Auth configuration verification and final regression pass are complete.
