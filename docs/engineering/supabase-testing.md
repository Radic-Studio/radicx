# Supabase Database Testing

M2 database tests live in `supabase/tests/` and use pgTAP against a clean Supabase reset.

The CI sequence is intentionally reproducible:

```bash
supabase start
supabase db reset
supabase seed buckets
supabase db lint --local --level warning
supabase test db
```

The tests cover schema existence, RLS enablement, private-schema isolation, question-key integrity, cross-user visibility, unauthorized cross-user updates, anonymous denial, answer-key denial, staff-role self-escalation denial, protected profile columns, session-answer uniqueness, recursive curriculum integrity, published revision immutability and private Storage foundations.

A hosted database containing manual state is not valid test evidence. Schema/security acceptance is based first on clean migration/reset tests, then repeated against hosted staging.
