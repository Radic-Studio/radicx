# M2 Acceptance Evidence

Status: IN PROGRESS — hosted staging blocked by Supabase service outage

This record is updated as M2 proceeds through SPECIFY -> BUILD -> TEST -> FIX -> RETEST -> REGRESSION -> STAGING VALIDATION -> ACCEPT.

## Build evidence

- Working branch: `feat/m2-supabase-core-security`
- Base/integration branch: `staging`
- Pull request: #13
- Production project: not created in M2.
- Hosted development/staging project: provisioning pending. Repeated approved creation attempts for `RadicX Staging` in London (`eu-west-2`) returned a Supabase `ServiceUnavailableException` identifying a partial system outage, and project listing confirmed that no partial project was created.

## Test / fix / retest evidence

Initial Database CI successfully started Supabase, rebuilt the database from all four migrations, seeded synthetic data and private Storage buckets, and passed database lint. The first pgTAP run exposed a test-harness SQL defect in the cross-user UPDATE assertion (`WITH` containing a data-modifying statement was nested below `SELECT`). The test was corrected to execute the mutation under the authenticated role and assert PostgreSQL's affected-row count.

Retest on commit `dffa84df104360992939f09b692a2ca74b67ef34` passed:

- existing M1 `CI / verify`: PASS;
- clean `supabase start`: PASS;
- `supabase db reset`: PASS, all migrations reapplied and synthetic seed loaded;
- declared private Storage bucket creation: PASS;
- `supabase db lint --local --level warning`: PASS, no schema errors;
- pgTAP: PASS, 3 files / 30 tests;
- generated TypeScript types: PASS and uploaded as CI artifact `database-generated-types`;
- repository secret scan/build regression: PASS through existing `verify` gate.

The generated-types artifact proves clean generation from the migration-defined database. Committing generated application types is intentionally deferred until an application layer consumes them; M2 does not manufacture an unused frontend dependency merely to produce another file.

## Acceptance checks

- [x] M1 inspected; no blocking M1 defect found.
- [x] Migration architecture added under `supabase/migrations/`.
- [x] Core schema authored.
- [x] Private question-key and staff-role domain authored.
- [x] RLS and explicit grants authored.
- [x] Targeted indexes authored.
- [x] Synthetic seed authored.
- [x] pgTAP schema/security tests authored.
- [x] Database CI workflow authored.
- [x] Clean CI database reset succeeds.
- [x] pgTAP tests pass (30/30).
- [x] Database lint passes with no schema errors.
- [x] Generated TypeScript type workflow succeeds from clean schema.
- [x] Application/M1 regression `verify` gate passes.
- [ ] Hosted staging project provisioned.
- [ ] Migrations applied to hosted staging.
- [ ] Hosted cross-user/security validation performed.
- [ ] Storage hosted-staging validation performed.
- [ ] Security Advisor reviewed and M2 findings resolved.
- [ ] Performance Advisor reviewed and M2 findings resolved/deferred with rationale.
- [ ] Staging validation completed.
- [ ] M2 accepted.

No item is marked complete merely because SQL/code exists. Hosted validation and advisor evidence remain required before acceptance.
