import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const htmlSurfaces = ['public/index.html', 'public/student.html', 'public/focus.html', 'public/exam.html', 'public/admin.html', 'public/design-system.html'];

async function text(path) {
  return readFile(path, 'utf8');
}

test('M3 shell surfaces exist and stay non-indexed', async () => {
  for (const path of htmlSurfaces) {
    const html = await text(path);
    assert.ok(html.length > 500, `${path} should be a substantive shell`);
    assert.match(html, /<meta name="robots" content="noindex,nofollow"/i, `${path} must not be indexed during M3`);
    assert.match(html, /class="[^"]*skip-link/i, `${path} needs a skip link`);
  }
});

test('approved identity and spacing tokens are implemented', async () => {
  const css = await text('src/design-system/tokens.css');
  for (const value of ['#fcfcfd', '#ffffff', '#f5f6f8', '#eaecf0', '#13141a', '#344054', '#667085', '#5457e8', '#7c3aed', '#14b8a6']) {
    assert.ok(css.toLowerCase().includes(value), `missing approved color token ${value}`);
  }
  for (const value of ['4px', '8px', '12px', '16px', '20px', '24px', '32px', '40px', '48px', '64px', '80px']) {
    assert.ok(css.includes(value), `missing spacing rhythm value ${value}`);
  }
  assert.match(css, /--radic-radius-small:\s*10px/);
  assert.match(css, /--radic-radius-standard:\s*14px/);
  assert.match(css, /--radic-radius-feature:\s*18px/);
  assert.match(css, /--radic-radius-pill:\s*999px/);
});

test('motion and accessibility foundations exist', async () => {
  const tokens = await text('src/design-system/tokens.css');
  const base = await text('src/design-system/base.css');
  const components = await text('src/design-system/components.css');
  assert.match(tokens, /--radic-duration-micro:\s*160ms/);
  assert.match(tokens, /--radic-duration-completion:\s*380ms/);
  assert.match(tokens, /--radic-duration-major:\s*760ms/);
  assert.match(base, /prefers-reduced-motion:\s*reduce/);
  assert.match(base, /:focus-visible/);
  assert.match(components, /min-height:\s*44px/);
});

test('component foundation exports required M3 primitives and later interfaces', async () => {
  const js = await text('src/components/radic-components.js');
  const required = ['RadicButton', 'RadicInput', 'RadicTextarea', 'RadicSelect', 'RadicCheckbox', 'RadicRadio', 'RadicCard', 'RadicBadge', 'RadicTabs', 'RadicProgress', 'RadicDialog', 'RadicSheet', 'RadicToast', 'RadicTooltip', 'RadicSkeleton', 'RadicEmptyState', 'RadicSyncState', 'RadicStat', 'RadicNavigation'];
  for (const name of required) assert.match(js, new RegExp(`export function ${name}\\b`), `missing ${name}`);
  for (const name of ['RadicAnswerOption', 'RadicQuestion', 'RadicReadiness', 'RadicMomentum', 'RadicMission', 'RadicAchievement', 'RadicExamTimer']) {
    assert.ok(js.includes(name), `missing specialized interface ${name}`);
  }
});

test('M2 migrations remain untouched on M3 branch', async () => {
  const required = [
    'supabase/migrations/20260904030000_m2_core_schema.sql',
    'supabase/migrations/20260904030100_m2_security_rls.sql',
    'supabase/migrations/20260904030200_m2_integrity_indexes_storage.sql',
    'supabase/migrations/20260904030300_m2_published_question_immutability.sql',
    'supabase/migrations/20260904054500_m2_advisor_indexes.sql',
    'supabase/migrations/20260904054800_m2_private_table_rls.sql'
  ];
  for (const path of required) assert.ok((await text(path)).length > 0, `${path} must remain present`);
});
