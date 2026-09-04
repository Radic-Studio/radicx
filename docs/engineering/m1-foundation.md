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
- [ ] Required CI status check is enforced by both branch rulesets.
- [ ] Netlify project connected to GitHub with Deploy Previews verified from a pull request.
- [x] Clean-clone CI run passes on GitHub-hosted runner.
- [ ] Staging deployment smoke-tested.

## Validation note

The hosted GitHub Actions CI job is named `verify`. This validation branch and pull request exist to exercise the `pull_request` workflow path so GitHub registers the check in branch-rule status-check selection and to provide regression evidence before M1 acceptance.

M1 must not be accepted until every blocking item above is verified. Generating files is not acceptance.
