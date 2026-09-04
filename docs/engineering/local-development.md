# Local Development

## Prerequisites

- Node.js 22
- npm 10.9.x
- Git
- Docker Desktop or another Docker-compatible runtime
- Supabase CLI

## Clean setup

```bash
git clone https://github.com/Radic-Studio/radicx.git
cd radicx
git checkout staging
npm ci --ignore-scripts
npm run verify
```

A successful application verification run performs lint checks, JavaScript syntax checks, unit tests, secret scanning, and a deterministic production build into `dist/`.

## Local Supabase

Start the local stack and rebuild the database entirely from version-controlled migrations and synthetic seed data:

```bash
supabase start
supabase db reset
supabase db lint --local --level warning
supabase test db
```

Generate browser/server TypeScript database definitions when required:

```bash
mkdir -p supabase/types
supabase gen types typescript --local --schema public,storage > supabase/types/database.generated.ts
```

The reset workflow is the source of truth for local schema reproducibility. Do not rely on manual Studio state that is absent from `supabase/migrations/`.

## Environment configuration

Copy `.env.example` to `.env` only when local runtime configuration is required. Never commit `.env`, production credentials, Supabase secret/service-role keys, database passwords, payment secrets, or other privileged values.

Browser configuration may contain only explicitly public values such as `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Privileged answer keys, scoring authority, staff authority, payment verification secrets, and Supabase secret keys remain trusted/server-side.

## Branch flow

- `main`: production release line.
- `staging`: production-like integration and acceptance line.
- short-lived feature/fix branches: branch from `staging`, merge by pull request after required checks.

## Milestone boundaries

M1 established the repository, CI and Netlify foundations. M2 adds the Supabase database/security foundation only. Product UI, onboarding, study flows and later milestone behavior remain intentionally deferred.
