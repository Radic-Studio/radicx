# RadicX

Repository for the RadicX V1 implementation.

The controlled product and architecture specification is the **RadicX V1.0 Comprehensive Project Brief (3 September 2026)**. Implementation proceeds milestone-by-milestone from M0 through M13.

## Current implementation

- M1 Repository & Engineering Foundation: accepted.
- M2 Supabase Core & Security Foundation: in progress on `feat/m2-supabase-core-security`.

Engineering documentation:

- `docs/engineering/local-development.md`
- `docs/engineering/m1-foundation.md`
- `docs/engineering/m2-supabase-foundation.md`

All database changes must be represented in `supabase/migrations/`. Supabase is the production authority for authentication, PostgreSQL, Storage, RLS and backend data; Hatchable is not a competing production database/authentication system.
