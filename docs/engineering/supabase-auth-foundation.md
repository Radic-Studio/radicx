# Supabase Authentication Foundation

M2 configures the architecture needed by later authentication/onboarding work without implementing the M5 UI.

- Email/password: enabled.
- Email confirmation: required in local configuration and required for hosted staging validation.
- Password recovery: supported through approved redirect URLs; UI is deferred to M5.
- Google OAuth: architecture-ready only; provider credentials are not committed and activation is deferred until configured for an approved environment.
- Phone authentication: disabled/deferred for V1 unless formal change control validates it.
- CAPTCHA/bot protection: required readiness item for abuse-prone hosted auth flows; provider secret remains trusted configuration and is never committed.
- MFA: TOTP is enabled locally for architecture readiness. Staff authorization helpers are designed for AAL2. Full admin MFA enforcement belongs to later admin/security milestones.
- SMTP: Supabase development mail facilities are acceptable for development; production custom SMTP remains a publishing requirement.

Browser code uses only the project URL and modern publishable key. Secret keys and Auth admin operations remain trusted/server-side.
