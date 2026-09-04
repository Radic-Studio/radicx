# Changelog

All notable RadicX implementation changes are recorded here by milestone.

## [Unreleased]

### M4 — Question Intelligence & Admin

- Added managed cognitive-level and clinical-task taxonomy tables while preserving the accepted M2 curriculum hierarchy.
- Added restricted source-governance, question-governance, review, import-staging and content-audit domains.
- Added deterministic question fingerprints, duplicate detection and one-open-revision-per-group protection.
- Added AAL2 + private-staff-role guarded RPCs for taxonomy, sources, question creation, answer-key updates, review submission, role-specific review decisions, publication, revisioning, quarantine and structured imports.
- Added server-authoritative publication gates covering rights, clinical review, item review, enhanced high-risk review, taxonomy and private answer-key presence.
- Extended published-question immutability to M4 risk/fingerprint fields and preserved historical revisions.
- Added staff-scoped private Storage policies for admin uploads and restricted source evidence.
- Upgraded the Admin shell into the M4 content-governance workspace without exposing stored answer keys or introducing M5+ business logic.
- Added M4 Node regression tests, pgTAP authorization/content-governance tests and engineering documentation.

### M3 — Design System & Application Shell

- Added RadicX semantic colour, typography, spacing, radii, elevation, motion and responsive tokens.
- Added the reusable RadicX primitive component layer and structural interfaces for later Study, Exam and Readiness components.
- Added responsive Public, Student, Focus, Exam and desktop-first Admin shells without introducing later milestone business logic.
- Added mobile bottom navigation, non-indexed design-system showcase, calm sync/offline states, loading primitives and non-punitive feedback styling.
- Added visible focus treatment, reduced-motion support, mobile touch-target foundations and keyboard interaction behavior for tabs and native dialogs/sheets.
- Added M3 static accessibility smoke checks, design-system regression tests and an initial bundle-size baseline gate.
- Preserved the accepted M2 Supabase migrations, RLS/security boundary and database workflow without adding M3 database changes.

### M2 — Supabase Core & Security Foundation

- Added version-controlled Supabase local configuration.
- Added core identity, curriculum, content, session, learning and student-utility schema.
- Added private answer-key and staff-role domain.
- Added explicit grants and Row Level Security ownership policies.
- Added recursive topic integrity and question revision foundations.
- Added targeted query indexes and Storage access foundation.
- Added reproducible synthetic seed fixtures.
- Added pgTAP schema/security tests including cross-user isolation and privilege-escalation checks.
- Added Supabase database CI workflow and type-generation artifact.
- Updated browser environment key naming to current Supabase publishable-key terminology.
- Added M2 architecture, security and local-development documentation.
- Completed hosted staging validation, advisor review and M2 acceptance before beginning M3.

## M1 — Repository & Engineering Foundation

- Established repository structure, deterministic Node build, CI verification, secret scanning, protected `main`/`staging` flow, Netlify previews, local setup documentation and staging validation.
