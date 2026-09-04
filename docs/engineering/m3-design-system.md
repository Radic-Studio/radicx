# M3 Design System & Application Shell

## Scope

M3 establishes the visual system, interaction language and structural shells defined by the RadicX V1.0 Comprehensive Project Brief. It intentionally does not implement question intelligence, authentication, Study, Review, Mock Exam, Readiness, Momentum, commerce or offline business logic.

## Visual philosophy

RadicX uses **Clinical Luxury × Expressive Intelligence**: a calm clinical foundation with selective expressive moments. Approximately 90% of interface surface should remain neutral. Indigo, Violet and Aqua are reserved for interaction, progress and meaningful emphasis rather than decorative saturation.

## Tokens

Tokens live in `src/design-system/tokens.css`.

### Colour

- Porcelain `#FCFCFD`
- White `#FFFFFF`
- Cloud `#F5F6F8`
- Hairline `#EAECF0`
- Ink `#13141A`
- Slate `#344054`
- Mist Text `#667085`
- Indigo `#5457E8`
- Violet `#7C3AED`
- Aqua `#14B8A6`

Interactive Prism is Indigo → Violet. Ambient Prism is Indigo → Violet → Aqua. Semantic success, warning, error, offline and review states include text/icons in addition to colour.

### Typography

Geist is the preferred face, with a system-ui fallback stack so the application does not block on a remote font. M3 does not ship a third-party font dependency. Type tokens cover display, page, section, question, body, supporting, label, statistic and button roles. Focused question typography scales to approximately 18px on mobile and 22px on larger screens with a 1.52 line-height.

### Spacing and shape

The spacing rhythm is `4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80`.

Radii:

- small: 10px
- standard: 14px
- feature: 18px
- pill: 999px

Elevation uses restrained soft, raised and dialog shadows. Cards are not the default container for every region.

## Responsive model

The CSS is mobile first and explicitly supports the approved ranges:

- 360–479: mobile
- 480–767: large phone
- 768–1023: tablet
- 1024–1439: desktop
- 1440+: wide desktop

General student/public width caps at 1240px. Focused reading width caps at 720px. Admin workspace supports up to 1600px.

## Component conventions

Reusable components are implemented in `src/components/radic-components.js` using native browser semantics and no visual framework dependency.

M3 primitives:

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

Structural interface contracts reserve later ownership for `RadicAnswerOption`, `RadicQuestion`, `RadicReadiness`, `RadicMomentum`, `RadicMission`, `RadicAchievement` and `RadicExamTimer`. Their business logic remains deferred.

### Extension rules

1. Prefer semantic HTML and existing tokens before adding dependencies.
2. Do not duplicate a branded component for one page when a reusable variant is sufficient.
3. Do not expose correctness, scoring, entitlement or other server-authoritative values through client-only logic.
4. New feedback states must not rely on colour alone.
5. Preserve 44px touch targets where practical.
6. Do not add decorative animation libraries for effects CSS/SVG can provide.
7. New M4+ logic must integrate with these shells rather than rebuilding them.

## Button hierarchy

Variants are Primary, Secondary, Ghost, Destructive, Text and Icon. Native disabled states, loading state, hover, pressed and focus-visible behavior are defined. Primary may use the Interactive Prism. Motion remains micro-duration only.

## Motion

Tokens:

- Micro: 160ms
- Completion: 380ms
- Major: 760ms

`prefers-reduced-motion: reduce` collapses transitions and animation to effectively immediate behavior.

## Accessibility

Foundations include:

- document landmarks and skip links;
- visible `:focus-visible` treatment;
- native form labels and controls;
- native `dialog` semantics for modal/dialog and sheet primitives;
- arrow/Home/End keyboard behavior for tabs;
- focus-visible tooltips;
- non-colour status labels;
- reduced-motion support;
- approximately 44px control/touch targets;
- scalable `clamp()` typography.

The repository includes a static accessibility smoke gate. Full manual screen-reader and browser accessibility regression remains part of later QA milestones, but M3 requires keyboard and visual foundation validation.

## Shell architecture

### Public shell

`public/index.html` provides reusable header, desktop/mobile navigation, CTA patterns, content-section primitives and footer. It is a minimal non-indexed M3 demonstration, not M10 marketing implementation.

### Student shell

`public/student.html` provides the responsive student application frame. Desktop anticipates Home, Study, Mock Exams, Review, Progress and Profile/Settings. Mobile bottom navigation anticipates Home, Study, Exam, Review and Progress. Later routes remain placeholders.

### Focus shell

`public/focus.html` removes routine navigation and expressive clutter, keeps a focused 720px reading region and reserves quiet content/action positions for later Study/Review functionality.

### Exam shell

`public/exam.html` is intentionally more restrained than Study/Focus. It reserves title, timer, question count, navigator, question area, Previous, Flag, Next and sync status positions. Controls are nonfunctional placeholders in M3.

### Admin shell

`public/admin.html` provides a desktop-first workspace with the approved Content, Assessment, Users, Analytics and System navigation architecture. No M4 administrative workflows are implemented.

## Loading and sync language

Loading primitives preserve layout with skeletons rather than defaulting to spinners. Sync states include Online, Syncing…, Offline · progress saved on this device and Sync required. M3 defines presentation only; M11 owns offline architecture.

## Performance

M3 uses no visual framework, icon package, animation library, WebGL, autoplay video or third-party runtime script. The build includes a `bundle:baseline` gate with intentionally conservative early-stage thresholds of 300 KiB total uncompressed output and 180 KiB combined CSS/JS. These are internal regression tripwires, not replacements for the Project Brief Web Vitals targets.
