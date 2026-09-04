# M1 Repository & Engineering Foundation

Status: in progress

## Approved outcome

Establish GitHub source control, reproducible local builds, CI verification, staging/production branch structure, secret hygiene, and Netlify preview readiness without implementing M2+ product features.

## Acceptance checklist

- [x] Private GitHub repository accessible.
- [x] `main` branch exists.
- [x] `staging` branch exists.
- [x] M1 work isolated on `chore/m1-engineering-foundation`.
- [x] Standard source, test, script, docs, and workflow structure added.
- [x] Deterministic dependency-locked Node 22 build foundation added.
- [x] CI verification workflow added.
- [x] Baseline repository secret scan added.
- [x] Netlify build/deploy-preview configuration added.
- [x] Local setup documented.
- [ ] GitHub branch protection/ruleset for `main` and `staging` verified active.
- [ ] Netlify project connected to GitHub with Deploy Previews verified from a pull request.
- [ ] Clean-clone CI run passes on GitHub-hosted runner.
- [ ] Staging deployment smoke-tested.

M1 must not be accepted until every blocking item above is verified. Generating files is not acceptance.
