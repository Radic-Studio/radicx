# M2 Hosted Staging Validation

Status: IN PROGRESS

## Project

- Supabase project: `RadicX Staging`
- Project ref: `bhcmfqabwvjawengpxvs`
- Organization: `Radic Studio`
- Actual hosted region reported by Supabase: `eu-west-1` (West Europe / Ireland)
- Health: `ACTIVE_HEALTHY`
- Production project: not created
- Data: synthetic M2 fixtures only

The manually created project landed in `eu-west-1`, rather than the originally proposed London `eu-west-2`. This remains within the approved European-region strategy. No latency claim is made; Nigerian network/device benchmarking remains a later acceptance activity.

## Hosted migration and data validation

Applied from the GitHub M2 branch in order:

1. `m2_core_schema`
2. `m2_security_rls`
3. `m2_integrity_indexes_storage`
4. `m2_published_question_immutability`
5. `m2_advisor_indexes`

The synthetic seed is loaded. Hosted schema inspection confirms all approved public M2 tables exist with RLS enabled. The private `question_keys` and `staff_roles` tables exist in the non-exposed `private` schema and have no grants to `anon` or `authenticated`.

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

`question-media` has authenticated read policy foundation. No browser policies exist for `source-evidence` or `admin-uploads`.

## Advisor review

### Security Advisor

Supabase Security Advisor reports one informational item: `public.question_sources` has RLS enabled without a policy. This is intentional in M2 because the table has no browser grant; source/provenance access is reserved for later trusted workflows.

A separate schema inspection surfaced a defense-in-depth warning that RLS is disabled on the two private tables. They are currently protected by all three controls below:

1. `private` is not an exposed Data API schema;
2. schema/table privileges are revoked from `anon` and `authenticated`;
3. hosted tests confirm browser-role access is denied.

Enabling RLS on `private.question_keys` and `private.staff_roles` with no browser policies would add a fourth fail-closed layer. Because the Supabase inspection tool explicitly requires user approval before applying that remediation, it remains pending a specific approval and M2 is not accepted yet.

### Performance Advisor

The first performance review found missing covering indexes for foreign keys. Migration `m2_advisor_indexes` added those indexes. A second review no longer reports unindexed foreign keys. Remaining `unused_index` informational notices are expected on a newly provisioned staging database with almost no workload and are not a reason to remove the M2 access-path indexes.

## Remaining hosted acceptance work

- obtain user approval on private-table RLS defense-in-depth remediation;
- apply/version-control that remediation if approved;
- rerun Security Advisor;
- verify hosted Auth dashboard settings that are not exposed by the current connector: email/password enabled, email confirmation enabled, phone disabled, recovery/redirect configuration ready, Google/CAPTCHA readiness documented;
- complete final CI/regression rerun and update M2 acceptance record;
- do not begin M3 until M2 is accepted.
