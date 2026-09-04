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

## UI implementation decision

- Auth, recovery and onboarding use the existing M3 tokens, fields, buttons, cards, focus treatment and responsive rules.
- Protected content remains visually hidden behind an auth-loading state until Supabase resolves the session.
- Onboarding persistence lives only in `public.profiles`; local storage is used only by Supabase Auth for its own session/PKCE state.
- The dashboard will show only profile/programme/exam/onboarding information and discovery of an existing resumable M2 session. Later readiness/recommendation/engagement values remain explicit unavailable states rather than fabricated numbers.

## RLS and security implications

- Supabase/RLS remains authoritative; protected HTML contains no private pre-rendered data.
- Profile access remains own-row only using `auth.uid()` in both `USING` and `WITH CHECK`.
- Browser grants remain column-limited and exclude identity, authorization, onboarding-version and server timestamp columns.
- Onboarding completion is constrained by persisted required values, not local storage or user metadata.
- No service-role/secret/database credential may enter source, browser bundles, Netlify browser variables or test fixtures.
- M2 private answer-key and staff-role boundaries remain unchanged.

## Test plan

- pgTAP: schema/constraints, active programme relationship, allowed own-profile update, cross-user denial, protected-column denial, invalid onboarding states and relevant index coverage.
- Node tests: auth-routing decisions, callback state parsing, onboarding transitions/resume, protected-route decisions, session restoration state and dashboard view models.
- Browser/manual where supported: signup, confirmation strategy, login, logout, recovery/reset, onboarding persistence, refresh restoration and protected-route denial.
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

Handoff inspection is complete. The first durable implementation increment is the M5 profile/onboarding migration plus pgTAP security/integrity coverage. Authentication UI and service implementation follows on the same feature branch.
