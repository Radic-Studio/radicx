# Supabase Migration Workflow

Database changes are authored as ordered SQL migrations under `supabase/migrations/` and reviewed through GitHub.

Rules:

1. Never treat manual hosted dashboard state as the canonical schema.
2. Author a migration for every important schema, constraint, policy, privilege, function, trigger or index change.
3. Validate with `supabase db reset` before promotion.
4. Run database lint and pgTAP after reset.
5. Prefer backward-compatible roll-forward changes and expand/contract evolution over destructive rollback assumptions.
6. Once a migration has been applied to a shared hosted environment, do not rewrite it casually; add a new corrective migration.

M2 migrations are still editable until their first successful shared hosted application. After hosted staging application, fixes use new ordered migrations.
