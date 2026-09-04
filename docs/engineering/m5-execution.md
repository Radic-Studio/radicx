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

## Planned implementation sequence

1. Verify current Supabase and Netlify configuration using current vendor documentation and read-only hosted inspection.
2. Add the smallest migration-driven extension to `public.profiles` for programme, exam date, daily study preference and resumable onboarding state.
3. Extend RLS/grants and pgTAP coverage for owner-only reads/updates, constrained onboarding completion and cross-user denial.
4. Add a pinned browser-safe Supabase client dependency and a small reusable Auth/profile/session service layer.
5. Implement signup, verification/callback, login, logout and password-recovery/reset surfaces.
6. Implement explicit auth-loading route guards and server-authoritative onboarding routing.
7. Implement resumable onboarding for programme, exam date, daily study preference and diagnostic start/skip handoff.
8. Activate the M3 Student Shell as the M5 dashboard using only persisted profile/programme/session data.
9. Extend unit/integration, accessibility, build, secret-scan and database regression coverage.
10. Validate locally, push logical commits, open a PR to `staging`, verify CI/Database CI/Netlify preview, review Supabase advisors and record acceptance evidence.

## Database changes

Planned profile additions:

- selected programme reference;
- expected exam date;
- constrained daily study-time preference;
- onboarding status, current step, version and completion timestamp;
- diagnostic invitation choice/timestamp for the M5-to-M7 handoff.

The migration will preserve the M2 `profiles.user_id` ownership key and existing new-user trigger. It will add only constraints/indexes justified by M5 and will not add readiness, mastery, commerce or staff-authorization fields.

## Auth changes

- Browser client uses only `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- A reusable Auth service will own current-user/session retrieval, auth-state events, signup, login, logout, resend verification, recovery and password update.
- Session restoration will render an explicit loading state before protected content.
- Verification and recovery callbacks will handle valid, invalid and expired links without leaking tokens.
- Hosted Auth configuration will be validated for email/password, confirmation, secure changes, disabled phone/anonymous access, TOTP preservation, OAuth readiness, redirect allow-list and CAPTCHA readiness.

## UI changes

- Add/refine login, signup, verify-email, callback, forgot-password and reset-password pages.
- Add a resumable onboarding surface using existing M3 tokens/components.
- Replace the Student Shell placeholder dashboard with real M5-supported profile/programme/exam/session states and honest later-milestone empty states.
- Add an intentional diagnostic-unavailable handoff for M7 ownership.
- Preserve mobile navigation and validate the requested 360–1024 px and desktop widths.

## RLS and security implications

- Supabase/RLS remains authoritative; protected HTML contains no private pre-rendered data.
- Profile access remains own-row only using `auth.uid()` in both `USING` and `WITH CHECK`.
- Browser grants remain column-limited and exclude identity, authorization and timestamp ownership fields.
- Onboarding completion will be constrained by persisted required values, not local storage or user metadata.
- No service-role/secret/database credential may enter source, browser bundles, Netlify browser variables or test fixtures.
- M2 private answer-key and staff-role boundaries will not be weakened.

## Test plan

- pgTAP: schema/constraints, active programme relationship, allowed own-profile update, cross-user denial, protected-column denial, invalid onboarding states and relevant index coverage.
- Node tests: auth-routing decisions, verification/recovery state parsing, onboarding transitions/resume, protected-route decisions, session restoration state and dashboard view models.
- Browser/E2E where supported: signup, confirmation strategy, login, logout, recovery/reset, onboarding persistence, refresh restoration and protected-route denial.
- Regression: lint, syntax/type boundary, all Node tests, secret scan, production build, accessibility smoke, bundle budget, clean Supabase reset, database lint and all pgTAP suites.
- Manual: keyboard-only completion, focus/error association, mobile layouts at 360/390/412/480/768/1024/desktop and Netlify Deploy Preview route/callback behavior.

## Explicit exclusions

- M6 Study Engine and question interaction/feedback logic.
- M7 diagnostic, mastery, spaced review, adaptive recommendations and learning calculations.
- M8 Mock Exam implementation.
- M9 readiness, Momentum, streaks, missions or achievements.
- Payments, commerce, custom production SMTP, Google OAuth activation, phone authentication, PWA/offline hardening and later-milestone business logic.

## Acceptance criteria

M5 is accepted only when the complete account lifecycle, verification handling, recovery/reset, session restoration, route protection, resumable server-authoritative onboarding, programme/exam/study-preference persistence, diagnostic handoff, truthful dashboard and resumable-session discovery all pass applicable application/database/security/accessibility/responsive/CI/preview/advisor gates with no committed secrets and all work present in GitHub.

## Current status

Baseline accepted and feature branch created. Architecture/schema inspection is in progress; no M5 implementation has yet been committed.
