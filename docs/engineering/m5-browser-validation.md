# M5 Browser Validation Evidence

Updated: 2026-09-04

## First hosted browser observation

The first real-browser signup check on the PR #20 Netlify Deploy Preview did **not** pass. The signup form rendered, but the controls were disabled and the page reported that authentication was unavailable because its public configuration was incomplete.

Root cause inspection confirmed that the M5 build generates `dist/assets/runtime-config.js` from `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The affected preview had been built without usable values for those public build variables.

## Correction

- Re-applied the browser-safe Supabase project URL and publishable key to the Netlify deploy-preview context.
- Re-applied the same public build configuration for branch-deploy so the later protected `staging` deployment can use the same staging Supabase project.
- Hardened `scripts/build.mjs` so a Netlify build now fails rather than publishing an unusable Auth UI when either required public variable is absent.
- No service-role key, database password, private answer key, or other privileged credential was added to source or browser configuration.

## Retest requirement

This is not acceptance evidence yet. A fresh Deploy Preview must build successfully after the configuration correction, then the real-browser signup, verification, login, onboarding, session restoration, logout, password recovery/reset, responsive and keyboard/accessibility checks must be repeated. PR #20 must remain unmerged until those hosted gates pass.
