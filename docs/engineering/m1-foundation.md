# M1 Repository & Engineering Foundation

Status: in progress

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
- [ ] Staging deployment smoke-tested.

## Validation note

GitHub pull-request and push workflows have completed successfully with the hosted `verify` job. Netlify production deployment from `main` is ready and a GitHub-linked Deploy Preview was verified ready through PR #7. PR #8 is the clean staging-path validation used to exercise the normal protected-branch workflow before the final staging deployment smoke test.

M1 must not be accepted until every blocking item above is verified. Generating files is not acceptance.
