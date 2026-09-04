# Supabase Advisor Review Gate

After the M2 migrations are applied to hosted staging, both Supabase Security Advisor and Performance Advisor must be run.

Security findings that indicate exposed private data, missing RLS, unsafe function configuration, excessive privileges or another M2 security defect are release-blocking until fixed and retested.

Performance findings are investigated against expected RadicX query paths. Useful index/query fixes are made in migrations. Findings that are not actionable in M2 may be deferred only with a written rationale and milestone owner review.

M2 cannot be accepted while a critical security warning is knowingly unresolved.
