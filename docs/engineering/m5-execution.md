# M5 Execution Record — Authentication, Onboarding & Student Foundation

Date started: 2026-09-04

## Objective

Deliver the production-quality student identity and first-use foundation for RadicX:

`SIGN UP → VERIFY ACCOUNT → LOG IN → COMPLETE OR RESUME ONBOARDING → ENTER STUDENT APP → RETURN WITH RESTORED SESSION`

M5 also activates a truthful authenticated dashboard baseline and discovers an existing resumable M2 session without implementing Study Engine behavior.

## Accepted dependencies

- Controlled product specification: RadicX V1.0 Comprehensive Project Brief, dated 2026-09-03.
- Accepted protected `staging` baseline: `fb57fe3043e97f8c3a027a9d7725e3d43302be01`.
- M4 acceptance reconciliation: PR #19, merged 2026-09-04; post-merge CI and Database CI passed.
- M2 owns Supabase Auth, PostgreSQL, RLS, private answer keys/staff roles, profiles, programmes and sessions.
- M3 owns the RadicX tokens, components and Public/Student/Admin/Focus/Exam shells.
- M4 owns question intelligence and administrative content workflows; those boundaries remain unchanged.
- GitHub is canonical, Supabase remains the sole production identity/data platform, and Netlify remains the deploy-preview/frontend platform.

## Verified handoff state

The feature branch `feat/m5-auth-onboarding` was verified at `f147fa1c9841cb1c2143757dc0a65b96055c8eb6`. That commit has accepted M4 staging head `fb57fe3043e97f8c3a027a9d7725e3d43302be01` as its direct parent and contains only this execution record. No unverified Codex workspace changes were present in GitHub and none are being assumed.

## Implementation sequence

1. Verify current Supabase and Netlify configuration using current vendor documentation and read-only hosted inspection.
2. Add the smallest migration-driven extension to `public.profiles` for programme, exam date, daily study preference and resumable onboarding state.
3. Extend RLS/grants and pgTAP coverage for owner-only reads/updates, constrained onboarding completion and cross-user denial.
4. Add a pinned browser-safe Supabase client and a small reusable Auth/profile/session service layer.
5. Implement signup, verification/callback, login, logout and password-recovery/reset surfaces.
6. Implement explicit auth-loading route guards and server-authoritative onboarding routing.
7. Implement resumable onboarding for programme, exam date, daily study preference and diagnostic start/skip handoff.
8. Activate the M3 Student Shell as the M5 dashboard using only persisted profile/programme/exam/session data.
9. Extend unit/integration, accessibility, build, secret-scan and database regression coverage.
10. Validate, push logical commits, open a PR to `staging`, verify CI/Database CI/Netlify preview, review Supabase advisors and record acceptance evidence.

## Database implementation decision

M5 extends `public.profiles` only with the approved first-use fields:

- `programme_id` referencing `public.programmes`;
- `expected_exam_date`;
- `daily_study_minutes` constrained to 10/20/30/45/60;
- onboarding status/current step/version/completion timestamp;
- diagnostic invitation decision/timestamp.

The onboarding version and server timestamps are not browser-writable. A private trigger stamps `updated_at`, diagnostic-decision time and completion time, and rejects selection of an inactive programme when the programme changes or onboarding completes. Database constraints prevent invalid step progression and prevent completed state until all required first-use inputs exist.

No readiness, mastery, streak, Momentum, entitlement, staff-role or later-milestone fields are added.

## Auth implementation decision

- Browser code uses only `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` injected into a generated non-secret runtime config during the Netlify build.
- Supabase JS is loaded as an exact-version browser ESM dependency; no service-role or secret key is bundled.
- The client uses persisted sessions, token auto-refresh and PKCE with explicit callback code exchange.
- Session restoration validates the locally restored session with `getUser()` before protected content is revealed.
- Signup, resend verification and password recovery use explicit environment-aware redirect URLs.
- Verification and recovery callbacks fail closed on missing/expired/invalid codes and do not render tokens.

The actual M5 client builds one callback endpoint per environment origin: `/auth-callback.html?flow=signup` for signup/verification and `/auth-callback.html?flow=recovery` for password recovery. Password login has no redirect callback. After a valid recovery code exchange, the application routes internally to `/reset-password.html`.

The minimum hosted staging Auth URL configuration required for final browser acceptance is:

- Site URL: `https://staging--radicx.netlify.app`
- `https://deploy-preview-20--radicx.netlify.app/auth-callback.html?flow=signup`
- `https://deploy-preview-20--radicx.netlify.app/auth-callback.html?flow=recovery`
- `https://staging--radicx.netlify.app/auth-callback.html?flow=signup`
- `https://staging--radicx.netlify.app/auth-callback.html?flow=recovery`

No production RadicX URL and no broad preview wildcard is approved for M5 staging acceptance.

## UI implementation decision

- Auth, recovery and onboarding use the existing M3 tokens, fields, buttons, cards, focus treatment and responsive rules.
- Protected content remains visually hidden behind an auth-loading state until Supabase resolves the session.
- Onboarding persistence lives only in `public.profiles`; local storage is used only by Supabase Auth for its own session/PKCE state.
- The dashboard shows only profile/programme/exam/onboarding information and discovery of an existing resumable M2 session. Later readiness/recommendation/engagement values remain explicit unavailable states rather than fabricated numbers.

## RLS and security implications

- Supabase/RLS remains authoritative; protected HTML contains no private pre-rendered data.
- Profile access remains own-row only using `auth.uid()` in both `USING` and `WITH CHECK`.
- Browser grants remain column-limited and exclude identity, authorization, onboarding-version and server timestamp columns.
- Onboarding completion is constrained by persisted required values, not local storage or user metadata.
- No service-role/secret/database credential may enter source, browser bundles, Netlify browser variables or test fixtures.
- M2 private answer-key and staff-role boundaries remain unchanged.

## Security Advisor reconciliation

The final-preacceptance Supabase Security Advisor reports WARN notices for M4 `SECURITY DEFINER` admin/content RPCs that intentionally retain `authenticated` EXECUTE. Those notices were not ignored and no blanket revoke was applied because that would break the accepted M4 browser-to-RPC administration model.

Hosted function inspection verifies that every `public.admin_*` RPC is a fixed-empty-`search_path` `SECURITY DEFINER` wrapper that invokes `private.require_staff(...)` before privileged work. `private.require_staff` itself is not executable by browser roles and requires a real authenticated user, JWT AAL2 and an allowed role from `private.staff_roles`. The `is_content_staff()` and `is_content_admin()` helpers independently require AAL2 and private staff-role membership and do not trust editable user metadata.

`supabase/tests/009_m5_m4_security_advisor_reconciliation.sql` was added to make this boundary executable regression evidence. It verifies all M4 admin RPCs reject both an AAL2 non-staff user with forged `user_metadata.role` and an AAL1 staff user, while the content helper functions enforce the same rules. Database CI #49 passed clean reset, lint, all pgTAP suites and generated types with this additional coverage.

The remaining Security Advisor `RLS Enabled No Policy` INFO notices are intentional fail-closed surfaces whose direct browser privileges are revoked, including private key, staff-role, governance, import and audit tables. Adding permissive policies merely to silence the linter would weaken the accepted boundary.

## Performance Advisor reconciliation

The current Performance Advisor reports only `unused_index` INFO notices on the fresh, low-traffic staging database. This includes the M5 `profiles_programme_idx` plus prior M2/M4 workload/FK indexes. There is no current unindexed-foreign-key or blocking performance finding. No index is removed before representative workload exists.

## Test plan and current automated result

- pgTAP: schema/constraints, active programme relationship, allowed own-profile update, cross-user denial, protected-column denial, invalid onboarding states, M4 privileged-RPC reconciliation and relevant index coverage.
- Node tests: auth-routing decisions, callback state parsing, onboarding transitions/resume, protected-route decisions, session restoration state and dashboard view models.
- Browser/manual: signup, confirmation strategy, login, logout, recovery/reset, onboarding persistence, refresh restoration and protected-route denial.
- Regression: lint, syntax/type boundary, all Node tests, secret scan, production build, accessibility smoke, bundle budget, clean Supabase reset, database lint and all pgTAP suites.
- Manual: keyboard-only completion, focus/error association, mobile layouts at 360/390/412/480/768/1024/desktop and Netlify Deploy Preview route/callback behavior.

Final-preacceptance automated state after the security reconciliation commit `7e4b3d0644c12f6b809f82406dd342fc7f75895e`:

- Application CI #72: PASS.
- Database CI #49: PASS, including clean migration reset, Storage seed, database lint, pgTAP and generated types.
- Netlify PR #20 Deploy Preview: READY/PASS at `https://deploy-preview-20--radicx.netlify.app`.
- Hosted RadicX Staging: M5 migration present; own-profile RLS and onboarding trigger active; private answer-key and private staff-role SELECT remain unavailable to browser roles.
- Security Advisor: reconciled as intentional M4 privileged-RPC WARNs plus fail-closed INFO notices, with added pgTAP coverage.
- Performance Advisor: INFO-only unused-index notices on fresh staging.

## Explicit exclusions

- M6 Study Engine and question interaction/feedback logic.
- M7 diagnostic, mastery, spaced review, adaptive recommendations and learning calculations.
- M8 Mock Exam implementation.
- M9 readiness, Momentum, streaks, missions or achievements.
- Payments, commerce, custom production SMTP, Google OAuth activation, phone authentication, PWA/offline hardening and later-milestone business logic.

## Acceptance criteria

M5 is accepted only when the complete account lifecycle, verification handling, recovery/reset, session restoration, route protection, resumable server-authoritative onboarding, programme/exam/study-preference persistence, diagnostic handoff, truthful dashboard and resumable-session discovery all pass applicable application/database/security/accessibility/responsive/CI/preview/advisor gates with no committed secrets and all work present in GitHub.

## Current status

**NEEDS CORRECTION / IN PROGRESS.**

Implementation, automated regression, hosted database validation, advisor reconciliation and PR Deploy Preview are green. Final acceptance is intentionally blocked until the exact hosted Supabase Auth Site URL/redirect allow-list above is saved and the real-browser lifecycle plus approved responsive/keyboard observations are completed. PR #20 must not merge before those manual hosted gates pass.
