# Changelog

All notable RadicX implementation changes are recorded here by milestone.

## [Unreleased]

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

Hosted staging provisioning, hosted advisor review and final staging validation remain pending until the Supabase platform project-creation outage clears.

## M1 — Repository & Engineering Foundation

- Established repository structure, deterministic Node build, CI verification, secret scanning, protected `main`/`staging` flow, Netlify previews, local setup documentation and staging validation.
