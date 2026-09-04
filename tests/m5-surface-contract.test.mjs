import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const authPages = ['login', 'signup', 'verify-email', 'forgot-password', 'reset-password', 'auth-callback'];
const protectedPages = ['student', 'focus', 'exam', 'onboarding'];

async function read(path) {
  return readFile(path, 'utf8');
}

test('M5 auth pages load only the public runtime config and M5 auth controller', async () => {
  for (const page of authPages) {
    const html = await read(`public/${page}.html`);
    assert.match(html, /<meta name="robots" content="noindex,nofollow"/);
    assert.match(html, /\/assets\/runtime-config\.js/);
    assert.match(html, /\/assets\/m5\/auth-pages\.js/);
    assert.doesNotMatch(html, /service_role|SUPABASE_SECRET|DATABASE_PASSWORD/i);
  }
});

test('protected student surfaces start hidden behind explicit auth loading state', async () => {
  for (const page of protectedPages) {
    const html = await read(`public/${page}.html`);
    assert.match(html, /data-auth-state="loading"/);
    assert.match(html, /m5-auth-loading/);
    assert.match(html, /m5-protected/);
    assert.match(html, /\/assets\/runtime-config\.js/);
  }
});

test('student dashboard states later milestone ownership instead of fabricating metrics', async () => {
  const html = await read('public/student.html');
  assert.match(html, /Readiness is not available in M5/);
  assert.match(html, /M9 owns readiness/);
  assert.match(html, /M7/);
  assert.doesNotMatch(html, /\b[0-9]{1,3}%\b/);
});

test('public shell exposes authentication entry points without activating later engines', async () => {
  const html = await read('public/index.html');
  assert.match(html, /href="\/login\.html"/);
  assert.match(html, /href="\/signup\.html"/);
  assert.match(html, /M5 activates student authentication/);
});

test('build runtime configuration only serializes approved browser-safe Supabase variables', async () => {
  const build = await read('scripts/build.mjs');
  assert.match(build, /PUBLIC_SUPABASE_URL/);
  assert.match(build, /PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(build, /SERVICE_ROLE|SUPABASE_SECRET|DATABASE_PASSWORD/);
});

test('M5 CSS includes the approved responsive breakpoint and protected-content guard', async () => {
  const css = await read('src/m5/auth-onboarding.css');
  assert.match(css, /data-auth-state="loading"/);
  assert.match(css, /visibility:\s*hidden/);
  assert.match(css, /@media \(min-width: 768px\)/);
  assert.match(css, /@media \(max-width: 479px\)/);
});
