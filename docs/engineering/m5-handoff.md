# M5 Handoff — Authentication, Onboarding & Student Foundation

Updated: 2026-09-04

## Branch

`feat/m5-auth-onboarding`

Accepted base: `fb57fe3043e97f8c3a027a9d7725e3d43302be01`

Latest durable implementation before this handoff update: `c7ffd793e6fa444a6888bf252cb5043ab0a79260`.

Pull request: not opened yet.

## Completed work

- Verified the M5 branch is directly based on the accepted M4 staging head and that no uncommitted Codex workspace was assumed.
- Added the migration-driven M5 profile/onboarding extension and pgTAP ownership/integrity coverage.
- Added a browser-safe Supabase client boundary using only the public project URL/publishable-key runtime configuration.
- Added validated session restoration, signup, resend verification, login, logout, password recovery/reset and PKCE callback service logic.
- Added server-persisted resumable onboarding for programme, exam date, daily-study preference and diagnostic Start/Skip handoff.
- Activated the Student Shell with truthful M5-supported profile/exam/session data and explicit later-milestone unavailable states.
- Protected Student, Focus and Exam surfaces behind an explicit auth-loading state, onboarding completion routing and fail-closed redirects.
- Added M5 Node/static surface tests and retained M3 design-system primitives/responsive conventions.

## Work in progress

- Run complete application regression through the PR CI gate.
- Run clean Supabase reset/lint/pgTAP through Database CI and correct any migration/test defects.
- Configure browser-safe staging Supabase variables for Netlify deploy-preview/branch-deploy contexts only.
- Open M5 PR to protected `staging` and validate the Deploy Preview.
- Apply the already-versioned M5 migration to hosted RadicX Staging only after Database CI is green.
- Validate hosted Auth redirect settings for the exact staging/Deploy Preview callback URLs.
- Run hosted security transactions plus Supabase Security and Performance Advisors.
- Complete responsive, keyboard and callback-path acceptance evidence.

## Remaining acceptance work

CI, Database CI, hosted migration/auth validation, Netlify Deploy Preview, advisor review, responsive/accessibility staging validation, protected merge and post-merge regression remain mandatory. M5 must remain `NEEDS CORRECTION / IN PROGRESS` until those gates pass.

## Known issues / risks

- Hosted Supabase M2 Auth configuration still recorded the Site URL as localhost and an empty redirect allow-list. Exact M5 staging/preview callbacks must be added before email verification/recovery can pass hosted validation. No broad wildcard should be introduced merely for convenience.
- The Supabase browser SDK is pinned to an exact browser ESM release. M11 owns offline/PWA hardening; M5 still requires online Auth access.
- Full Study/Diagnostic/Mock/Readiness behavior is intentionally absent and must not be interpreted as an M5 defect.

## Latest CI state

No M5 PR CI run has executed yet because the branch has not yet been opened against `staging`.
