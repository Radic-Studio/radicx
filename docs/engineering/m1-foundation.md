# M1 Repository & Engineering Foundation

Status: accepted

## Approved outcome

Establish GitHub source control, reproducible local builds, CI verification, staging/production branch structure, secret hygiene, and Netlify preview readiness without implementing M2+ product features.

## Acceptance checklist

- [x] Public GitHub repository accessible.
- [x] `main` branch exists.
- [x] `staging` branch exists.
- [x] M1 implementation work was isolated on `chore/m1-engineering-foundation`.
- [x] Standard source, test, script, docs, and workflow structure added.
- [x] Deterministic dependency-locked Node 22 build foundation added.
- [x] CI verification workflow added.
- [x] Baseline repository secret scan added.
- [x] Netlify build/deploy-preview configuration added.
- [x] Local setup documented.
- [x] GitHub rulesets are active and target `main` and `staging` separately.
- [x] Required `verify` CI status check is enforced by both branch rulesets.
- [x] Netlify project connected to GitHub with a ready Deploy Preview verified from PR #7.
- [x] Clean-clone CI run passes on GitHub-hosted runner.
- [x] Staging deployment smoke-tested.

## Acceptance evidence

GitHub pull-request and push workflows pass with the hosted `verify` job. The verification chain includes Node 22 setup, deterministic install, lint, syntax/type boundary checks, 4/4 foundation tests, baseline secret scan, and build. Netlify production deployment from `main` is ready, and a GitHub-linked Deploy Preview was verified ready through PR #7.

After the Netlify `staging` branch deploy setting was enabled, PR #9 passed the protected pre-merge CI gate and merged into `staging`. The resulting staging push on commit `944f2231a0f32c7c3258ffc713d056209079524c` passed the full `verify` workflow. The staging smoke check first observed HTTP 404 while the deployment was being created, then HTTP 401 on the second attempt, confirming the staging deployment was live behind the configured Netlify team SSO access control. GitHub issue #5 was closed as resolved.

Before the final promotion to `main`, the repository histories were reconciled because `main` contained an earlier M1 promotion commit while later validation continued independently on `staging`. The reconciliation merge preserves the accepted `staging` tree while incorporating the existing `main` history, removing add/add promotion conflicts without discarding validated files.

No database migration was introduced in M1. No M2+ product functionality was introduced.

M1 acceptance is recorded after SPECIFY, BUILD, TEST, FIX, RETEST, REGRESSION and STAGING VALIDATION completed successfully.
