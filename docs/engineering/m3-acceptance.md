# M3 Acceptance Record — Design System & Application Shell

Date: 2026-09-04

## Status

**NEEDS CORRECTION / INDEPENDENT MANUAL VALIDATION PENDING**

The M3 implementation, automated verification, database regression and Netlify Deploy Preview gates are green. M3 is intentionally not declared accepted yet because the Project Brief requires manual keyboard testing and responsive visual validation at the approved breakpoints. Those browser-observation checks must be independently completed before the milestone can move to PASS.

## Authoritative scope

M3 is limited to design tokens, RadicX component foundations, responsive Public/Student/Focus/Exam/Admin shells, reduced-motion/focus foundations, accessibility smoke checks, loading/sync visual language, performance baseline and documentation. No M4+ business logic is included.

## GitHub evidence

- Feature branch: `feat/m3-design-system-shell`
- Pull request: `#15 — M3: Design System & Application Shell`
- PR head at validation: `7f6f8bcc5b8a6a50c2ad2817e9a618b8a2ad53aa`
- Staging merge commit: `44e8527a24d6dee4c9e498d0ae0374500cb50641`
- PR CI run: CI #47 — PASS
- PR database run: Database #24 — PASS
- Staging CI run: CI #49 — PASS
- Staging database run: Database #26 — PASS
- Netlify Deploy Preview for PR #15: `https://deploy-preview-15--radicx.netlify.app`

## Components implemented

- `RadicButton`
- `RadicInput`
- `RadicTextarea`
- `RadicSelect`
- `RadicCheckbox`
- `RadicRadio`
- `RadicCard`
- `RadicBadge`
- `RadicTabs`
- `RadicProgress`
- `RadicDialog`
- `RadicSheet`
- `RadicToast`
- `RadicTooltip`
- `RadicSkeleton`
- `RadicEmptyState`
- `RadicSyncState`
- `RadicStat`
- `RadicNavigation`

Later-milestone structural interfaces are reserved without business logic for `RadicAnswerOption`, `RadicQuestion`, `RadicReadiness`, `RadicMomentum`, `RadicMission`, `RadicAchievement` and `RadicExamTimer`.

## Tokens implemented

- Approved neutral and identity colours
- Interactive Prism and Ambient Prism
- Semantic success, warning, error, offline and review states
- Geist-preferred system-fallback typography roles
- Approved 4px spacing rhythm
- 10 / 14 / 18 / 999px radii
- Restrained elevation tokens
- 160 / 380 / 760ms motion tiers
- 1240px general content cap
- 720px focused reading cap
- 1600px admin workspace cap
- visible focus-outline token

## Shells implemented

- Public shell with responsive header, mobile sheet navigation, CTA patterns and footer
- Student shell with desktop left navigation and mobile bottom navigation
- Focus shell with quiet focused reading region
- Exam shell with structural timer/count/navigator/question/actions/sync positions and no M8 logic
- Admin shell with approved Content / Assessment / Users / Analytics / System navigation architecture and no M4 workflows
- Non-indexed design-system showcase route

## Automated verification

The `verify` pipeline runs lint, typecheck, Node tests, secret scan, build, accessibility smoke and bundle baseline.

PR CI and staging CI both passed. M3 regression tests cover approved tokens, responsive breakpoints and width caps, shell/navigation architecture, component exports, keyboard contracts for tabs, reduced-motion/focus foundations and preservation of M2 migration files.

## Accessibility

Automated/static checks passed for:

- document language and viewport
- main landmarks
- skip links
- accessible naming checks for dialogs and buttons
- image `alt` checks where images exist
- visible focus treatment
- native labelled form controls
- keyboard arrow/Home/End contracts for tabs
- non-colour status labels
- `prefers-reduced-motion`
- approximately 44px primary control/touch targets

**Pending acceptance item:** manual browser keyboard traversal and focus-order inspection across Public, Student, Focus, Exam, Admin and showcase surfaces.

## Responsive validation

CSS/test coverage confirms the approved responsive model and breakpoints:

- 360–479 mobile
- 480–767 large phone
- 768–1023 tablet
- 1024–1439 desktop
- 1440+ wide desktop

**Pending acceptance item:** manual visual inspection at representative widths 360, 480, 768, 1024 and 1440, including mobile bottom navigation, desktop rails, wrapping, overflow and touch-target behavior.

## Performance / bundle

M3 introduces no UI framework, icon library, animation library, WebGL, autoplay video or third-party runtime script. A bundle baseline gate is included with early regression limits of 300 KiB total uncompressed build output and 180 KiB combined CSS/JS. The gate passed in CI. These thresholds are regression tripwires, not replacements for the V1 Web Vitals targets.

Full Lighthouse/device/network acceptance remains part of later performance hardening, while M3 maintains the lightweight design-system requirement.

## M2 regression

PASS.

The M3 diff contains no Supabase migration changes. Both PR and staging database workflows successfully rebuilt from migrations/seed, linted the database, executed pgTAP tests and regenerated database types.

The hosted `RadicX Staging` Supabase project remains `ACTIVE_HEALTHY`. Current advisor notices are informational M2-era notices only: intentionally policy-less locked/private tables and unused indexes in the fresh staging workload. No M3 DDL or policy regression was introduced.

## Files / areas changed

Primary M3 areas:

- `src/design-system/`
- `src/components/`
- `src/app.js`
- `src/styles.css`
- `public/index.html`
- `public/student.html`
- `public/focus.html`
- `public/exam.html`
- `public/admin.html`
- `public/design-system.html`
- `scripts/a11y-smoke.mjs`
- `scripts/bundle-baseline.mjs`
- `tests/m3-design-system.test.mjs`
- `docs/engineering/m3-design-system.md`
- `CHANGELOG.md`
- `package.json` / `package-lock.json`

No M3 migrations were added.

## Acceptance criteria status

| Criterion | Status |
| --- | --- |
| Design tokens implemented | PASS |
| Branded component foundation exists | PASS |
| Student shell responsive structure | PASS, manual visual review pending |
| Mobile bottom navigation | PASS, manual visual review pending |
| Focus shell | PASS |
| Exam shell | PASS |
| Admin shell | PASS |
| Public shell | PASS |
| Automated accessibility smoke | PASS |
| Manual keyboard behavior | **PENDING** |
| Reduced-motion support | PASS |
| Responsive breakpoint implementation/tests | PASS |
| Manual responsive visual check | **PENDING** |
| Build / CI | PASS |
| M2 database regression | PASS |
| Bundle/performance baseline | PASS |
| Netlify Deploy Preview | PASS |
| Documentation | PASS |
| No M4+ business logic introduced | PASS |

## Unresolved issues

1. Independent manual keyboard/focus traversal has not yet been observed in a browser.
2. Independent responsive visual inspection at 360 / 480 / 768 / 1024 / 1440 remains required.
3. The staging CI Netlify smoke step was skipped by GitHub Actions even though the CI verification itself passed; PR #15 Deploy Preview is green. The staging branch deployment should therefore be visually/reachability checked during the independent review rather than inferred from the skipped step.

None of these issues justify beginning M4. M3 remains at the acceptance gate until they are resolved.

## Deferred items

No V1.1/V2 feature was added. Night Study theme remains V1.1 as defined by the project brief. Full Study, Review, Mock Exam, Readiness, Momentum, commerce and offline architecture remain assigned to their approved later V1 milestones.
