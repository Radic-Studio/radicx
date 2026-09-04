import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const requiredFiles = [
  'README.md',
  'package.json',
  'package-lock.json',
  'netlify.toml',
  '.env.example',
  'public/index.html',
  'src/app.js',
  'src/styles.css'
];

test('M1 required foundation files exist', async () => {
  for (const file of requiredFiles) {
    const content = await readFile(file, 'utf8');
    assert.ok(content.length > 0, `${file} should not be empty`);
  }
});

test('package scripts include verification gates', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  for (const script of ['build', 'lint', 'typecheck', 'test', 'scan:secrets', 'verify']) {
    assert.ok(packageJson.scripts?.[script], `missing npm script: ${script}`);
  }
});

test('Netlify publishes the deterministic dist directory', async () => {
  const config = await readFile('netlify.toml', 'utf8');
  assert.match(config, /publish\s*=\s*"dist"/);
  assert.match(config, /command\s*=\s*"npm run build"/);
});

test('private local env files are ignored', async () => {
  const ignore = await readFile('.gitignore', 'utf8');
  assert.match(ignore, /^\.env$/m);
  assert.match(ignore, /^\.env\.\*$/m);
  assert.match(ignore, /^!\.env\.example$/m);
});
