# Supabase Environment Separation

RadicX V1 uses separate data expectations by environment:

- Local: synthetic developer fixtures only.
- CI: ephemeral clean reset, synthetic fixtures only.
- Staging: production-like hosted validation using synthetic or explicitly sanitized data only.
- Production: real controlled user data; not provisioned in M2.

Netlify deploy previews must never be wired to unrestricted production data or privileged keys. Browser configuration is environment-specific and publishable only. Any secret key or database password belongs in trusted environment configuration, never repository files or frontend bundles.
