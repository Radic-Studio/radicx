import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const requiredM2Files = [
  'supabase/config.toml',
  'supabase/seed.sql',
  'supabase/migrations/20260904030000_m2_core_schema.sql',
  'supabase/migrations/20260904030100_m2_security_rls.sql',
  'supabase/migrations/20260904030200_m2_integrity_indexes_storage.sql',
  'supabase/migrations/20260904030300_m2_published_question_immutability.sql',
  'supabase/migrations/20260904054500_m2_advisor_indexes.sql',
  'supabase/tests/001_schema_integrity.sql',
  'supabase/tests/002_rls_security.sql',
  'supabase/tests/003_content_storage_integrity.sql',
  'supabase/tests/004_advisor_indexes.sql',
  '.github/workflows/database.yml',
  'docs/engineering/m2-supabase-foundation.md'
];

test('M2 Supabase foundation files are version controlled', async () => {
  for (const file of requiredM2Files) {
    const content = await readFile(file, 'utf8');
    assert.ok(content.length > 0, `${file} should not be empty`);
  }
});

test('browser environment template uses publishable-key terminology only', async () => {
  const env = await readFile('.env.example', 'utf8');
  assert.match(env, /^PUBLIC_SUPABASE_PUBLISHABLE_KEY=$/m);
  assert.doesNotMatch(env, /PUBLIC_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(env, /SUPABASE_(?:SECRET|SERVICE_ROLE)_KEY\s*=/i);
});

test('private answer and staff structures live in private schema', async () => {
  const schema = await readFile('supabase/migrations/20260904030000_m2_core_schema.sql', 'utf8');
  assert.match(schema, /create table private\.question_keys/i);
  assert.match(schema, /create table private\.staff_roles/i);
  assert.doesNotMatch(schema, /create table public\.question_keys/i);
  assert.doesNotMatch(schema, /create table public\.staff_roles/i);
});
