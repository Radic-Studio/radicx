# Supabase Hosted Staging Validation

The M2 hosted project is development/staging only and must contain no real student PII.

Validation sequence after provisioning:

1. Confirm the project region and environment identity.
2. Apply the exact GitHub migration set in order.
3. Synchronize declared private Storage buckets.
4. Load only synthetic M2 seed fixtures.
5. Verify Auth settings against the M2 foundation.
6. Run cross-user authorization probes.
7. Confirm answer-key/staff-role objects are unavailable through browser roles.
8. Generate database types from the verified schema.
9. Run Security Advisor and Performance Advisor.
10. Fix findings, retest and record evidence before acceptance.

A hosted project created manually with untracked schema state is not acceptable evidence.
