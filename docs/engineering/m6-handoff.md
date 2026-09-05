# M6 Handoff — Study Engine

Status: IN PROGRESS

## GitHub

- Repository: `Radic-Studio/radicx`
- Branch: `feat/m6-study-engine`
- Accepted protected staging base verified before branch creation: `f3c0bb9fc2806562f929ece8dca0c0e130265c2e`
- Current PR: none yet
- Latest verified M6 commit: pending initial execution-record commit

## Completed

- Verified live protected `staging` still points to the accepted M5 baseline.
- Verified `main` remains behind staging by design.
- Verified no open PR currently targets `staging`.
- Reviewed M5 acceptance/Auth/session foundation, M4 question-governance architecture, M3 design system and M2 schema/RLS foundation.
- Confirmed hosted `RadicX Staging` Supabase project is `ACTIVE_HEALTHY` and M1–M5 migrations are present through `m5_profile_onboarding`.
- Created `feat/m6-study-engine` from the verified staging head.
- Defined M6 implementation architecture in `docs/engineering/m6-execution.md`.

## Work in progress

- M6 database Study manifest, safe delivery and answer-evaluation migration.
- M6 Study UI/client working-state layer and IndexedDB/outboxes.

## Remaining

- Implement migration and pgTAP coverage.
- Implement Study Home, Focus question flow, bookmark/report/sync/completion/resume UI.
- Add application tests and accessibility/bundle regression.
- Run clean CI/Database CI and fix/retest.
- Apply hosted migration to RadicX Staging and run synthetic hosted validation.
- Review Supabase Security/Performance Advisors.
- Open `feat/m6-study-engine -> staging` PR and validate Netlify Deploy Preview.
- Perform answer-key leak, responsive, keyboard/accessibility, offline/reconnect and performance validation.
- Merge only after all pre-merge gates pass.
- Run post-merge staging validation and finalize `docs/engineering/m6-acceptance.md`.

## Known defects

None identified yet in the accepted M5 baseline that block M6.

## Latest validation state

- Application CI: M5 accepted baseline PASS; M6 not yet run.
- Database CI: M5 accepted baseline PASS; M6 not yet run.
- Netlify: accepted M5 staging deployment PASS; M6 Deploy Preview not yet created.
- Supabase: `RadicX Staging` healthy; M6 migration not yet applied.
