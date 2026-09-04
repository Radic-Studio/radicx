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

## Hosted browser retest

After the corrected Deploy Preview was published, the supervising user completed the requested M5 hosted browser acceptance sequence and reported **PASS** on 2026-09-04. This is user-observed manual evidence, not an assistant-operated browser result.

The requested acceptance sequence covered:

- signup and client-side validation;
- email verification and return through the approved signup callback;
- login, logout, protected-route denial and return-session restoration;
- resumable onboarding for programme, expected exam date and daily-study preference;
- interruption/refresh and onboarding resume;
- onboarding completion and diagnostic Start/Skip handoff;
- authenticated Student Dashboard rendering with M5-supported data;
- forgot-password, recovery callback, password reset and subsequent login;
- responsive checks at 360, 390, 412, 768, 1024 and desktop widths;
- keyboard/focus, labels/errors, password toggles, mobile navigation and overflow observations.

## Final pre-merge browser status

**PASS — USER-OBSERVED.**

The initial browser configuration defect was corrected before merge. The application code has not changed after the passing hosted browser retest; this evidence-only update records the result for M5 acceptance. PR #20 remains subject to fresh CI, Database CI and Netlify Deploy Preview checks for this documentation commit before protected merge.
