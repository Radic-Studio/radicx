# Supabase Storage Foundation

M2 declares three private buckets in `supabase/config.toml`:

- `question-media`: student-safe media that can be retrieved by authenticated users. Listing is intentionally not granted by the M2 Storage policy.
- `source-evidence`: restricted source/provenance evidence. No browser access.
- `admin-uploads`: protected administrative import staging. No browser access.

The local/CI workflow runs `supabase seed buckets` after database reset so bucket configuration is reproducible. For a linked hosted staging project, bucket declarations are synchronized with `supabase seed buckets --linked` or an equivalent supported Storage-management operation. Source scans and restricted administrative material must never be moved into a public bucket.

Object creation, replacement and deletion should go through the Storage API. Direct mutation of `storage.objects` metadata is not an application workflow.
