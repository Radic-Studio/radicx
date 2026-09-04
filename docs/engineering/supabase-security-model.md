# Supabase Security Model

## Trust boundary

The authenticated browser is untrusted. Browser clients may submit legitimate student inputs, but do not receive direct authority over answer keys, staff roles, correctness, readiness or other privileged/derived values.

## API exposure

The Data API exposes only configured schemas. M2 keeps `private` outside the exposed schema list and separately revokes `anon`/`authenticated` schema/table access. Public tables still use explicit grants plus RLS, so both object privilege and row ownership must succeed.

## Student ownership

Ownership policies use `auth.uid()` rather than values in user-editable metadata. Student A can operate only on Student A rows where a write policy exists. Derived summary tables are owner-readable but not client-writable.

## Staff authority

Staff roles are stored in `private.staff_roles`. No browser role can insert/update the table. A forged `user_metadata.role` value does not confer staff authority. Later admin workflows must use trusted server operations and AAL2 checks.

## Answer keys

Correct answers and private explanations are in `private.question_keys`, not in `public.questions`. Public question rows contain only browser-safe question content. Private key access is denied to `anon` and `authenticated`.

## Default privileges

M2 changes default privileges for newly created objects to fail closed. Later migrations must deliberately grant Data API access instead of relying on historical Supabase auto-grant behavior.

## Storage

All three M2 buckets are private. `question-media` permits authenticated object retrieval only. `source-evidence` and `admin-uploads` have no browser policies in M2. Uploads remain trusted/admin-side future work.
