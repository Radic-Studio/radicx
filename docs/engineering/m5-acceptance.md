# M5 Acceptance Record — Authentication, Onboarding & Student Foundation

Date accepted: 2026-09-04

Status: **PASS**

## Scope accepted

M5 delivers the approved student identity and first-use foundation only:

`SIGN UP → VERIFY ACCOUNT → LOG IN → COMPLETE OR RESUME ONBOARDING → ENTER STUDENT APP → RETURN WITH RESTORED SESSION`

Accepted M5 behavior includes email/password signup and login, account verification callback handling, resend verification, logout, password recovery/reset, validated session restoration, protected student routing, resumable server-authoritative onboarding, programme/exam-date/daily-study persistence, diagnostic Start/Skip handoff, and the truthful authenticated Student Dashboard baseline with existing-session discovery.

No M6 or later learning-engine, mock-exam, readiness, Momentum, streak, commerce, production SMTP, Google OAuth, phone-auth or PWA/offline behavior is accepted by this record.

## GitHub delivery

- Repository: `Radic-Studio/radicx`
- Feature branch: `feat/m5-auth-onboarding`
- Feature PR: `#20 — M5: Authentication, Onboarding & Student Foundation`
- Feature PR status: MERGED
- Final feature commit: `6fdfee6a7718d2f6bf650bae39c2964f6890c855`
- Protected `staging` merge commit: `eefe65f8c67023b9a9b0a161daf96aa13ce180b7`
- Acceptance-record branch: `docs/m5-acceptance`

The M5 feature branch was merged only after current-head Application CI, Database CI, Netlify Deploy Preview, hosted Supabase checks, advisor review and user-observed hosted browser validation passed.

## Database and migration

Hosted Supabase project: `RadicX Staging` (`bhcmfqabwvjawengpxvs`).

M5 migration recorded in hosted migration history:

- `20260904101010 — m5_profile_onboarding`
- Repository migration: `supabase/migrations/20260904100000_m5_profile_onboarding.sql`

The migration extends `public.profiles` with the approved M5 onboarding fields only: programme, expected exam date, daily study duration, onboarding status/current step/version/completion timestamp and diagnostic invitation decision/timestamp.

Database constraints and the private onboarding guard enforce valid step progression, allowed daily-study values, active-programme selection and server-stamped completion/diagnostic timestamps.

## RLS and security model

M5 preserves the existing browser-untrusted Supabase security boundary:

- Profile reads remain own-row only through `auth.uid() = user_id`.
- Profile updates remain own-row only with matching `USING` and `WITH CHECK` conditions.
- Browser UPDATE grants remain column-limited and exclude identity, authorization, onboarding-version and server-owned timestamp fields.
- Cross-user profile changes are denied.
- Protected `user_id` changes are denied.
- Invalid daily-study values, onboarding progression and completion states are rejected by the database.
- Anonymous profile writes are denied.
- `private.question_keys` and `private.staff_roles` remain unavailable to browser roles.
- No service-role key, database password, private answer key or privileged credential is bundled into the browser or source control.

M4 privileged content RPCs remain unchanged. Advisor warnings for authenticated `SECURITY DEFINER` functions were explicitly reconciled with hosted function inspection and pgTAP regression coverage in `supabase/tests/009_m5_m4_security_advisor_reconciliation.sql`. Those RPCs use fixed search paths, call private staff authorization checks before privileged work, require AAL2 and real `private.staff_roles` membership, and reject forged editable metadata.

## Supabase Auth configuration

Hosted staging Auth URL configuration was saved and browser-validated with:

- Site URL: `https://staging--radicx.netlify.app`
- `https://deploy-preview-20--radicx.netlify.app/auth-callback.html?flow=signup`
- `https://deploy-preview-20--radicx.netlify.app/auth-callback.html?flow=recovery`
- `https://staging--radicx.netlify.app/auth-callback.html?flow=signup`
- `https://staging--radicx.netlify.app/auth-callback.html?flow=recovery`

No production RadicX URL or broad Netlify wildcard was added for M5 staging acceptance.

Browser configuration uses only the public Supabase project URL and browser-safe publishable key. During hosted validation, an initial Deploy Preview exposed missing public Netlify build variables and correctly disabled Auth. The defect was fixed by restoring the required public build variables and hardening `scripts/build.mjs` so Netlify now fails a build rather than publishing an unusable Auth UI when either required variable is absent.

## Automated validation

Final pre-merge feature-head validation at `6fdfee6a7718d2f6bf650bae39c2964f6890c855`:

- Application CI #76: PASS.
- Database CI #53: PASS.
- Netlify PR #20 Deploy Preview: READY/PASS.
- Supabase project health: ACTIVE_HEALTHY.

Database CI includes a clean local Supabase startup/reset from migrations and seed, Storage seed, database lint, all pgTAP suites and generated TypeScript database types.

Application CI includes repository verification, M5 Node tests, surface-contract regression, secret scan, production build, accessibility smoke and bundle-budget checks.

Post-merge validation on protected `staging` at `eefe65f8c67023b9a9b0a161daf96aa13ce180b7`:

- Application CI #77: PASS.
- Database CI #54: PASS.
- Hosted Supabase project: ACTIVE_HEALTHY.

## Hosted browser validation

Real-browser validation was performed against the PR #20 Netlify Deploy Preview after the public-config correction and was user-observed as PASS.

The hosted lifecycle covered the required M5 acceptance path: signup, verification handling, login, onboarding, session restoration, protected-route behavior, logout, password recovery/reset, diagnostic Start/Skip handoff, dashboard arrival and the approved responsive/keyboard/accessibility observations.

Evidence for the initial browser defect and passing retest is recorded in `docs/engineering/m5-browser-validation.md`.

## Responsive and accessibility validation

The M5 responsive/manual validation was user-observed as PASS after the corrected Deploy Preview. The approved check covered the required mobile/tablet/desktop widths and auth/onboarding/dashboard surfaces, including no blocking overflow, usable controls, labels/errors, visible keyboard focus, password toggles and mobile navigation behavior.

Automated accessibility smoke and M3 shell-contract regression also remained green.

## Netlify staging validation

After PR #20 merged, the protected staging deployment was smoke-tested by the user at:

`https://staging--radicx.netlify.app`

Observed result: PASS.

The smoke confirmed that the site loaded without the prior missing-Supabase-configuration error, the test account could sign in and reach the Student Dashboard, and logout returned to the public/login state.

## Supabase Security Advisor

Final post-merge Security Advisor review completed on 2026-09-04.

Accepted non-blocking findings:

1. `RLS Enabled No Policy` INFO findings on deliberate fail-closed/private surfaces, including private audit/import/governance/key/staff tables and `public.question_sources`. Direct browser privileges remain revoked; adding permissive policies merely to silence the linter would weaken the boundary.
   - Remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

2. `Signed-In Users Can Execute SECURITY DEFINER Function` WARN findings on the accepted M4 admin/content RPC boundary and `is_content_staff()` / `is_content_admin()`. These are intentional browser-callable entry points guarded by AAL2 plus private staff-role checks and covered by regression tests.
   - Remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

3. `Leaked Password Protection Disabled` WARN. Supabase documents leaked-password protection as a Pro-plan-and-above feature. The current M5 application enforces an 8-character minimum in its user flow, but HaveIBeenPwned-based leaked-password rejection is not active on the current staging plan. This is recorded as a plan-dependent hardening item and must be enabled before production launch if the production Supabase plan supports it.
   - Remediation reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

No unreviewed blocking security finding remains for M5 staging acceptance.

## Supabase Performance Advisor

Final post-merge Performance Advisor review reports INFO-only `unused_index` notices on the fresh/low-traffic staging database, including `profiles_programme_idx` and existing M2/M4 workload/FK indexes.

No index was removed without representative workload evidence. These notices are retained for later production-performance review rather than converted into speculative schema churn.

- Remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

## Defects found and corrected during acceptance

One blocking hosted defect was found during real-browser validation:

- Symptom: signup controls were disabled and the page reported that authentication was unavailable because public configuration was incomplete.
- Root cause: Netlify Deploy Preview lacked usable `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_PUBLISHABLE_KEY` build values.
- Fix: restore the browser-safe public values for deploy-preview and branch-deploy, then harden `scripts/build.mjs` so hosted builds fail if those values are absent.
- Retest: fresh Deploy Preview READY, Application CI PASS, Database CI PASS and real-browser Auth lifecycle PASS.

No merge-first/fix-later exception was used.

## Known limitations and deferred work

The following are intentionally outside M5 and remain deferred to their approved milestones or production hardening work:

- M6 Study Engine and question interaction/feedback behavior.
- M7 diagnostic/mastery/spaced-review/adaptive recommendation logic.
- M8 Mock Exam behavior.
- M9 readiness, Momentum, streaks, missions and achievements.
- Payments/commerce.
- Production SMTP.
- Google OAuth activation.
- Phone authentication.
- PWA/offline hardening.
- Production leaked-password protection where supported by the selected Supabase plan.

The M5 dashboard therefore continues to show only supported persisted M5 data and explicit unavailable states for later metrics rather than fabricated readiness, mastery or engagement values.

## Acceptance decision

M5 has completed the required lifecycle:

`SPECIFY → BUILD → TEST → FIX → RETEST → REGRESSION → STAGING VALIDATION → ACCEPT`

All mandatory M5 application, database, RLS/security-regression, hosted Auth, onboarding, CI, Database CI, Deploy Preview, post-merge staging, responsive/accessibility and advisor-review gates have passed or have been explicitly reconciled as non-blocking, documented findings.

**M5 ACCEPTANCE STATUS: PASS**

Do not infer acceptance of M6 or any later milestone from this record.
