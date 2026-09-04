# Supabase Key Strategy

RadicX follows the current Supabase key model for new application work.

Browser-safe configuration uses the project URL plus a publishable key (`sb_publishable_...`). A publishable key is not an authorization boundary; RLS and explicit grants remain mandatory.

Trusted server/backend operations may use a Supabase secret key where needed. Secret keys, legacy service-role credentials, database passwords, JWT signing material and other privileged values must never be exposed to browser bundles, committed to Git, or copied into public deployment variables.

The repository template intentionally contains only blank public configuration names, never live key values.
