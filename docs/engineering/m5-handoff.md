# M5 Handoff — Authentication, Onboarding & Student Foundation

Updated: 2026-09-04

## Branch and PR

- Branch: `feat/m5-auth-onboarding`
- Accepted M4 base / current protected `staging`: `fb57fe3043e97f8c3a027a9d7725e3d43302be01`
- Latest durable implementation/security reconciliation commit before this documentation update: `7e4b3d0644c12f6b809f82406dd342fc7f75895e`
- Pull request: `#20 — M5: Authentication, Onboarding & Student Foundation`
- PR target: protected `staging`
- PR state: OPEN / unmerged

## Completed work

- Verified the M5 branch remains based on the accepted M4 staging head and no uncommitted Codex workspace was assumed.
- Added the migration-driven M5 profile/onboarding extension and pgTAP ownership/integrity coverage.
- Added a browser-safe Supabase client boundary using only the public project URL/publishable-key runtime configuration.
- Added validated session restoration, signup, resend verification, login, logout, password recovery/reset and PKCE callback service logic.
- Added server-persisted resumable onboarding for programme, exam date, daily-study preference and diagnostic Start/Skip handoff.
- Activated the Student Shell with truthful M5-supported profile/exam/session data and explicit later-milestone unavailable states.
- Protected Student, Focus and Exam surfaces behind an explicit auth-loading state, onboarding completion routing and fail-closed redirects.
- Preserved M3 shell/navigation contracts after the first M5 regression exposed a missing Profile label.
- Applied the version-controlled M5 profile migration to hosted `RadicX Staging` and validated own-row RLS, protected-column behavior, onboarding constraints and server timestamp guards.
- Re-ran Supabase Security and Performance Advisors.
- Inspected every advisor-reported M4 `SECURITY DEFINER` admin/content function and the private `require_staff` gate.
- Added `supabase/tests/009_m5_m4_security_advisor_reconciliation.sql` to verify every M4 admin RPC rejects AAL2 non-staff users with forged metadata and AAL1 staff users.
- Re-ran CI and Database CI after that reconciliation: CI #72 PASS and Database #49 PASS.
- Current Netlify PR #20 Deploy Preview is READY/PASS at `https://deploy-preview-20--radicx.netlify.app`.

## Security reconciliation

The current Security Advisor WARN notices for the M4 `admin_*`, `is_content_staff()` and `is_content_admin()` `SECURITY DEFINER` functions are intentional architecture signals, not unexamined warnings. Hosted inspection confirms:

- all `admin_*` RPCs use `SECURITY DEFINER` with `search_path=''`;
- `anon` cannot execute them;
- `authenticated` can reach the RPC boundary but privileged work is gated by `private.require_staff(...)`;
- `private.require_staff` itself is not browser-executable and requires `auth.uid()`, AAL2, and an allowed role from `private.staff_roles`;
- forged editable user metadata is irrelevant to authorization;
- content helper RPCs independently require AAL2 and private staff-role membership;
- Database CI #49 passed the added full-RPC regression coverage.

The remaining `RLS Enabled No Policy` INFO notices are expected on deliberately fail-closed private/direct-browser-denied surfaces. No permissive policy is being added merely to reduce advisor noise.

The Performance Advisor currently reports INFO-only unused indexes on fresh staging, including `profiles_programme_idx`; these are retained until representative workload evidence exists.

## Exact Auth configuration still required

The connected Supabase management interface does not expose hosted Auth Site URL / redirect allow-list mutation. This is the one required human configuration step before hosted email lifecycle testing.

Set **Authentication → URL Configuration** on project **RadicX Staging** to:

- Site URL: `https://staging--radicx.netlify.app`
- Additional Redirect URL: `https://deploy-preview-20--radicx.netlify.app/auth-callback.html?flow=signup`
- Additional Redirect URL: `https://deploy-preview-20--radicx.netlify.app/auth-callback.html?flow=recovery`
- Additional Redirect URL: `https://staging--radicx.netlify.app/auth-callback.html?flow=signup`
- Additional Redirect URL: `https://staging--radicx.netlify.app/auth-callback.html?flow=recovery`

Do not add a production RadicX URL and do not use a broad Netlify wildcard for M5 staging acceptance.

## Remaining acceptance work

1. Save/verify the exact hosted Auth URL configuration above.
2. Observe the real hosted browser lifecycle on the Deploy Preview: signup, email confirmation, resend, valid/invalid login, session restoration, protected routes, resumable onboarding, truthful dashboard, logout, forgot/reset password and invalid/expired callback behavior.
3. Complete responsive/manual accessibility observations at 360, 390, 412, 480, 768, 1024 and desktop, including keyboard traversal, visible focus, labels/error association, touch targets, reduced motion and overflow/mobile navigation.
4. Fix/retest if those observations expose defects.
5. Reconfirm all pre-merge checks, then merge PR #20 through protected `staging` only if every gate passes.
6. Run post-merge Application CI, Database CI, Netlify staging deployment/Auth smoke and hosted Supabase health checks.
7. Only after successful post-merge validation create the PASS M5 acceptance record through a protected documentation PR. Do not modify `staging` directly.

## Known limitations / intentional deferrals

- Full Study/Diagnostic/Mock/Readiness behavior is intentionally absent and belongs to M6–M9.
- Google/phone Auth, production SMTP, commerce and PWA/offline hardening are later-scope items.
- M5 browser Auth requires network access; M11 owns offline/PWA hardening.

## Latest automated state

- Application CI #72: **PASS**.
- Database CI #49: **PASS** (clean reset, seed, lint, all pgTAP, generated DB types).
- Netlify PR #20 Deploy Preview: **PASS / READY**.
- Hosted M5 migration: **present** on `RadicX Staging`.
- Hosted profile RLS / private key / staff-role boundaries: **PASS**.
- Security Advisor: **reconciled**, with intentional M4 privileged-RPC WARNs now covered by additional regression tests and intentional fail-closed INFO notices documented.
- Performance Advisor: **reviewed**, INFO-only unused-index notices on fresh staging.
- Final M5 acceptance: **NEEDS CORRECTION / IN PROGRESS** pending hosted Auth URL configuration and real-browser/manual acceptance.
