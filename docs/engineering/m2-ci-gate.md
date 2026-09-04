# M2 CI Gate

The existing M1 `CI / verify` workflow remains intact. M2 adds a separate `Database / database` workflow that must pass before M2 acceptance. Database CI starts a clean local Supabase stack, resets migrations/seed, synchronizes buckets, lints the database, runs pgTAP and generates TypeScript types.
