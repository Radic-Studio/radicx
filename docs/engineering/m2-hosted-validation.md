# M2 Hosted Staging Validation

Status: ACCEPTED

## Project

- Supabase project: `RadicX Staging`
- Project ref: `bhcmfqabwvjawengpxvs`
- Organization: `Radic Studio`
- Actual hosted region reported by Supabase: `eu-west-1` (West Europe / Ireland)
- Health: `ACTIVE_HEALTHY`
- Production project: not created
- Data: synthetic M2 fixtures only

The manually created project landed in `eu-west-1`, rather than the originally proposed London `eu-west-2`. This remains within the approved European-region strategy. No unsupported latency claim is made; Nigerian network/device benchmarking remains a later acceptance activity.

## Hosted migration and data validation

Applied from the GitHub M2 branch in order:

1. `m2_core_schema`
2. `m2_security_rls`
3. `m2_integrity_indexes_storage`
4. `m2_published_question_immutability`
5. `m2_advisor_indexes`
6. `m2_private_table_rls`

The synthetic seed is loaded. Hosted schema inspection confirms all approved public M2 tables exist with RLS enabled. `private.question_keys` and `private.staff_roles` exist in the non-exposed `private` schema, have RLS enabled, have no browser policies, and remain unavailable to `anon` and `authenticated`.

## Hosted authorization validation

Transactional synthetic-user checks were executed and rolled back:

- Student A sees exactly Student A's session: PASS
- Student A sees exactly Student A's profile: PASS
- Student A updating Student B's session affects zero rows: PASS
- authenticated browser role reading `private.question_keys`: denied with SQLSTATE `42501`: PASS
- authenticated browser role inserting `private.staff_roles`: denied with SQLSTATE `42501`: PASS
- anonymous profile read: denied with SQLSTATE `42501`: PASS
- authenticated update of protected profile columns: denied with SQLSTATE `42501`: PASS
- duplicate `(session_id, question_id)` answer insert: rejected with SQLSTATE `23505`: PASS

No real student record was created by these checks because test transactions were rolled back.

## Storage validation

Three hosted buckets exist and are private:

- `question-media`: 10 MiB; image/PDF allow-list
- `source-evidence`: 25 MiB; image/PDF allow-list
- `admin-uploads`: 25 MiB; image/PDF/CSV/XLSX allow-list

`question-media` has authenticated-read policy foundation. No browser policies exist for `source-evidence` or `admin-uploads`.

## Hosted Auth dashboard validation

The Supabase Dashboard settings were reviewed interactively against the M2 Auth foundation:

- new user signup: enabled;
- anonymous sign-in: disabled;
- email provider: enabled;
- email confirmation: enabled;
- secure email change: enabled;
- secure password change: enabled during guided validation;
- phone provider/signup: disabled;
- Google provider: disabled/unconfigured for now, with readiness preserved for the later authentication milestone;
- TOTP (Authenticator App) MFA: enabled;
- AAL1 session-duration limiting: enabled;
- SMS MFA: disabled;
- Site URL: `http://localhost:3000` for the current pre-auth-UI stage;
- redirect allow-list: empty, with no unsafe wildcard;
- CAPTCHA: available/configurable but intentionally disabled in M2 because provider keys and the real auth UI are not yet being activated;
- leaked-password screening: disabled because the Dashboard marks it as Pro-only; no paid-plan upgrade is introduced by M2;
- custom SMTP: deferred to the later email/commerce milestone.

This satisfies M2's Auth configuration/readiness requirement without prematurely implementing the M5 student account lifecycle or M10 production email configuration.

## Advisor review

### Security Advisor

Final review on 2026-09-04 reports only three INFO notices for `RLS Enabled No Policy`:

- `private.question_keys`;
- `private.staff_roles`;
- `public.question_sources`.

These are intentional fail-closed states. Browser access is not granted to these tables in M2. There are no critical/high M2 security findings.

Reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

### Performance Advisor

The first performance review found missing covering indexes for foreign keys. Migration `m2_advisor_indexes` added those indexes. Final review no longer reports unindexed foreign keys. Remaining notices are INFO-level `unused_index` findings on a fresh staging database with almost no representative workload. The indexes are retained because they cover known ownership, relationship, review and content access paths and should be reconsidered only after representative workload evidence exists.

Reference: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

## Acceptance result

Hosted staging validation is complete. The M2 security, authorization, storage, Auth-readiness, advisor and regression gates have no remaining blocking defect. M2 is accepted subject to ordinary protected integration into `staging`; M3 must not be included in this PR.
