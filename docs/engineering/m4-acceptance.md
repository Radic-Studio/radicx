# M4 Acceptance Record — Question Intelligence & Admin

Date: 2026-09-04

## Status

**PASS — ACCEPTED**

The M4 implementation, corrective hardening, automated CI, Database CI, Netlify Deploy Preview, hosted Supabase migration validation, answer-key isolation checks, authorization contract validation, advisor review, protected `staging` merge and post-merge staging regression have all passed. M4 is accepted and may be closed.

M5 has not started.

## Authoritative scope

M4 is limited to the Question Intelligence & Admin milestone: managed classification taxonomy, source/provenance governance, private review records, publication gates, immutable revisioning, quarantine, structured import staging/deduplication, staff-scoped private Storage, content audit logging and the M4 Admin workspace.

No M5 authentication/onboarding implementation and no Study, Review, Mock Exam, Readiness, commerce or offline/PWA business logic is included.

## GitHub evidence

- Feature branch: `feat/m4-question-intelligence-admin`
- Implementation pull request: `#18 — M4: Question Intelligence & Admin`
- Accepted M3 staging baseline: `81f222ae21b8c1e9e2917b77cb010a43854666fa`
- Pre-acceptance validated M4 head: `c18812515d766e7e64c20775cb43c3fd18918722`
- Pre-merge acceptance-record head: `42dcc675e915faf04ab6067d598b590e51748641`
- Implementation merge commit into `staging`: `760963958068857b3ae183a04eb097157cfa7a78`
- Pre-merge CI #66: PASS
- Pre-merge Database #43: PASS
- Netlify Deploy Preview for PR #18: `https://deploy-preview-18--radicx.netlify.app` — PASS
- Post-merge staging CI #67: PASS
- Post-merge staging Database #44: PASS
- Post-merge staging Netlify branch deployment smoke: PASS

An earlier Database #42 first attempt failed because its hosted runner could not bind the local Supabase port 54322. The exact unchanged M4 head was rerun after the runner conflict cleared and passed all database steps. This was an infrastructure-runner conflict, not an M4 code or migration defect.

## Migrations

M4 adds six version-controlled migrations:

1. `20260904090000_m4_content_governance.sql`
2. `20260904090100_m4_admin_workflows.sql`
3. `20260904090200_m4_public_rpc_contracts.sql`
4. `20260904090300_m4_public_numeric_contracts.sql`
5. `20260904090400_m4_admin_execute_lockdown.sql`
6. `20260904090500_m4_advisor_indexes.sql`

Hosted `RadicX Staging` has the corresponding migration records:

- `m4_content_governance`
- `m4_admin_workflows`
- `m4_public_rpc_contracts`
- `m4_public_numeric_contracts`
- `m4_admin_execute_lockdown`
- `m4_advisor_indexes`

## Database and security model

M4 implements:

- managed `cognitive_levels` and `clinical_tasks` taxonomy;
- question risk tier and deterministic content fingerprinting;
- private source governance, question governance and review records;
- private structured import batches and rows;
- private content audit log;
- AAL2 plus `private.staff_roles` authorization for all administrative content actions;
- role-specific rights, clinical and item review permissions;
- publication gates for rights, clinical, item, enhanced high-risk review, taxonomy and private answer-key presence;
- immutable published/quarantined/archived revisions;
- correction by new revision rather than mutation of published content;
- quarantine rather than deletion for problematic live questions;
- deterministic import deduplication and draft-only promotion;
- eight M4 Storage policies for staff-scoped `admin-uploads` and Content-Admin-only `source-evidence` prefixes;
- content-critical audit logging.

## Answer-key isolation

PASS.

Hosted validation confirms:

- `anon` has no SELECT privilege on `private.question_keys`;
- `authenticated` has no SELECT privilege on `private.question_keys`;
- M4 private governance/import/audit tables remain direct-browser inaccessible;
- `admin_list_questions` does not return `correct_option` or `explanation_private`;
- gate-status RPCs expose only boolean/key-presence state, never the stored answer;
- revision and import workflows copy/create keys internally inside the private boundary.

## RPC authorization hardening

Hosted validation identified PostgreSQL's default `PUBLIC EXECUTE` privilege on newly created security-definer functions. Although the internal `private.require_staff()` gate already rejected unauthorized callers, M4 was hardened rather than relying on that default grant.

`20260904090400_m4_admin_execute_lockdown.sql` revokes execution from `PUBLIC` and `anon` for all M4 `admin_*` RPCs and the content-role helper RPCs, while retaining explicit `authenticated` grants. Hosted verification after the migration reports:

- anonymous-executable M4 admin RPC count: `0`;
- authenticated M4 admin RPCs missing required execute permission: `0`;
- anonymous execution of `is_content_staff()` and `is_content_admin()`: disabled.

A hosted transaction test also verified:

- AAL2 user with a matching private Content Admin role is recognized as staff/admin;
- the same staff user at AAL1 is rejected by the content authorization helpers;
- an ordinary AAL2 user cannot forge `user_metadata.role = content_admin` to gain access;
- the validation transaction was rolled back and left no test user/role fixture behind.

## Automated testing

Application CI runs lint, typecheck, Node tests, secret scanning, production build, accessibility smoke and bundle baseline.

Database CI rebuilds local Supabase from migrations and seed, reseeds declared Storage buckets, performs database lint, executes pgTAP and regenerates TypeScript database types.

M4 database coverage includes:

- taxonomy and private governance schema;
- AAL2/private-role authorization;
- publication gate failure and success paths;
- rights/clinical/item role separation;
- high-risk enhanced-review contract;
- answer-key isolation;
- published-content immutability;
- revision creation and quarantine;
- import staging, validation and duplicate detection;
- draft-only import promotion;
- staff-scoped Storage boundaries;
- audit-log creation;
- anonymous RPC execute denial and authenticated RPC availability;
- safe admin list return contract;
- advisor-reported foreign-key index coverage.

The earlier pgTAP plan mismatch was corrected from 30 to 33 assertions. The correction changed only the declared test plan; the individual M4 assertions had already passed.

The final pre-merge acceptance-record commit passed CI #66 and Database #43. The implementation merge commit `760963958068857b3ae183a04eb097157cfa7a78` then passed staging CI #67 and Database #44, including database reset, Storage seed, database lint, pgTAP, generated types and artifact upload.

## Hosted Supabase validation

PASS on project `bhcmfqabwvjawengpxvs` (`RadicX Staging`).

Verified after hosted migration application:

- all M4 schema objects and question columns are present;
- RLS is enabled on all new private M4 tables;
- direct authenticated access to restricted M4 private tables is revoked;
- all eight M4 Storage object policies exist;
- anonymous M4 admin RPC execution is revoked;
- authenticated RPC contracts remain available and enforce AAL2/private staff roles;
- answer-key storage remains private;
- the Admin question list does not return stored answer keys/private explanations;
- all six M4 migrations are present in hosted migration history.

## Supabase Security Advisor

PASS with documented intentional notices.

No Security Advisor ERROR/FATAL finding blocks M4.

The remaining `rls_enabled_no_policy` INFO notices apply to intentionally locked deny-by-default tables such as `private.question_keys`, M4 private governance/import/audit tables, `private.staff_roles`, and the existing controlled `public.question_sources` surface. Direct browser privileges are revoked, so adding permissive row policies would weaken the intended boundary rather than improve it.

The Advisor also reports `authenticated_security_definer_function_executable` WARN notices for the intentionally browser-callable M4 staff RPCs. These are accepted by design because the RPC layer is the controlled privileged boundary: each administrative RPC uses a fixed empty `search_path`, is unavailable to `anon`, and calls `private.require_staff()` to require an authenticated AAL2 session plus an authorized role from `private.staff_roles` before privileged work. Hosted transaction validation confirms that forged metadata and AAL1 sessions do not pass this boundary.

These findings are documented architecture signals, not unresolved authorization defects.

## Supabase Performance Advisor

PASS.

The initial M4 advisor pass identified five unindexed foreign keys. M4 added `20260904090500_m4_advisor_indexes.sql` to cover:

- `private.import_batches.source_id`;
- `private.import_rows.promoted_question_id`;
- `private.question_source_governance.reviewed_by`;
- `public.questions.clinical_task`;
- `public.questions.cognitive_level`.

The post-fix Advisor no longer reports `unindexed_foreign_keys` for M4. Remaining findings are `unused_index` INFO notices on a fresh staging database. Those indexes support declared foreign-key, governance, content-selection and later-workload query paths; no index is removed before representative workload evidence exists.

## Netlify / staging validation

PASS.

PR #18 Deploy Preview was green at:

`https://deploy-preview-18--radicx.netlify.app`

After the protected merge, staging CI #67 also completed its `Smoke-test Netlify branch deployment` step successfully. The Admin surface remains within the M3 design system and does not introduce a second frontend framework or later-milestone student business logic.

## M2 / M3 regression

PASS.

Database CI reconstructs the complete database from the accepted M2 migrations through all M4 migrations, executes the existing M2 tests plus M4 tests, lints the database, seeds Storage declarations and regenerates types. Application CI continues to run the M3 accessibility/build/bundle gates. Both the final pre-merge and post-merge staging regression runs passed.

## Files / areas changed

Primary M4 areas:

- `src/m4/`
- `public/admin.html`
- `tests/m4-content-workflow.test.mjs`
- `supabase/migrations/20260904090000_m4_content_governance.sql`
- `supabase/migrations/20260904090100_m4_admin_workflows.sql`
- `supabase/migrations/20260904090200_m4_public_rpc_contracts.sql`
- `supabase/migrations/20260904090300_m4_public_numeric_contracts.sql`
- `supabase/migrations/20260904090400_m4_admin_execute_lockdown.sql`
- `supabase/migrations/20260904090500_m4_advisor_indexes.sql`
- `supabase/tests/005_m4_question_intelligence_admin.sql`
- `supabase/tests/006_m4_rpc_privilege_boundary.sql`
- `supabase/tests/007_m4_advisor_indexes.sql`
- `docs/engineering/m4-question-intelligence-admin.md`
- `docs/engineering/m4-acceptance.md`
- package/build documentation metadata changed as recorded in PR #18.

## Acceptance criteria status

| Criterion | Status |
| --- | --- |
| Managed question taxonomy | PASS |
| Source/provenance governance | PASS |
| Role-separated review workflow | PASS |
| Publication gates | PASS |
| High-risk enhanced review | PASS |
| Private answer-key isolation | PASS |
| Published revision immutability | PASS |
| Revision workflow | PASS |
| Quarantine workflow | PASS |
| Structured import staging/dedupe | PASS |
| Import promotes to Draft only | PASS |
| Staff-scoped private Storage | PASS |
| Content audit trail | PASS |
| AAL2 + private staff-role authorization | PASS |
| Anonymous admin RPC execute denied | PASS |
| Database lint | PASS |
| pgTAP | PASS |
| Node/application CI | PASS |
| M2/M3 regression | PASS |
| Netlify Deploy Preview | PASS |
| Hosted Supabase migration validation | PASS |
| Security Advisor review | PASS with documented intentional INFO/WARN notices |
| Performance Advisor review | PASS; M4 unindexed FKs corrected |
| Protected staging merge | PASS |
| Post-merge staging CI | PASS |
| Post-merge staging Database CI | PASS |
| Post-merge Netlify branch smoke | PASS |
| No M5 implementation | PASS |

## Unresolved issues

None blocking M4 acceptance.

The remaining Supabase Advisor notices are documented intentional security-boundary warnings/informational notices and fresh-workload unused-index notices. They do not represent a failed M4 acceptance criterion.

## Deferred items

M5 authentication/onboarding, Study, Review, Mock Exam, Readiness, commerce and PWA/offline product behavior remain assigned to their approved later milestones. No V1.1/V2 feature was silently added.

## Final acceptance decision

**M4 — Question Intelligence & Admin: PASS / ACCEPTED.**

Acceptance is based on the protected PR #18 merge to `staging`, green final pre-merge CI/Database CI and Deploy Preview, hosted Supabase migration/security validation, documented Advisor review, and green post-merge staging CI #67, Database #44 and Netlify branch-deployment smoke. Development must stop at the M4 boundary. M5 has not started.
