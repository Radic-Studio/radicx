import { execFileSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const roots = ['src', 'scripts', 'tests'];
const files = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
      continue;
    }
    if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) files.push(full);
  }
}

for (const root of roots) await walk(root);

for (const file of files) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}

console.log(`Syntax/type boundary checks passed for ${files.length} JavaScript modules.`);
