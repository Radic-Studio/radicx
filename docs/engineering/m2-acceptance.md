# M2 Acceptance Evidence

Status: IN PROGRESS

This record is updated as M2 proceeds through SPECIFY -> BUILD -> TEST -> FIX -> RETEST -> REGRESSION -> STAGING VALIDATION -> ACCEPT.

## Build evidence

- Working branch: `feat/m2-supabase-core-security`
- Base/integration branch: `staging`
- Production project: not created in M2.
- Hosted development/staging project: provisioning pending due to a Supabase partial service outage encountered during approved project creation.

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
- [ ] Clean CI database reset succeeds.
- [ ] pgTAP tests pass.
- [ ] Database lint passes.
- [ ] Generated types committed and consistency check enabled.
- [ ] Hosted staging project provisioned.
- [ ] Migrations applied to hosted staging.
- [ ] Hosted cross-user/security validation performed.
- [ ] Storage staging validation performed.
- [ ] Security Advisor reviewed and M2 findings resolved.
- [ ] Performance Advisor reviewed and M2 findings resolved/deferred with rationale.
- [ ] Staging validation completed.
- [ ] M2 accepted.

No item is marked complete merely because SQL/code exists. Test and staging evidence are required before acceptance.
