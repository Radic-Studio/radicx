# Local Development

## Prerequisites

- Node.js 22
- npm 10.9.x
- Git

## Clean setup

```bash
git clone https://github.com/Radic-Studio/radicx.git
cd radicx
git checkout staging
npm ci --ignore-scripts
npm run verify
```

A successful verification run performs lint checks, JavaScript syntax checks, unit tests, secret scanning, and a deterministic production build into `dist/`.

## Environment configuration

Copy `.env.example` to `.env` only when local runtime configuration is required. Never commit `.env`, production credentials, Supabase service-role keys, payment secrets, or other privileged values.

The browser may eventually receive only explicitly public client configuration. Privileged answer keys, scoring authority, staff authority, payment verification secrets, and Supabase service-role credentials must remain server-side.

## Branch flow

- `main`: production release line.
- `staging`: production-like integration and acceptance line.
- short-lived feature/fix branches: branch from `staging`, merge by pull request after required checks.

## M1 scope note

The temporary static shell is infrastructure verification only. Product UI, authentication, database schema, and learning features are intentionally deferred to their approved milestones.
