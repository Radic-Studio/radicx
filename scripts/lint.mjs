import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const roots = ['src', 'scripts', 'tests'];
const extensions = new Set(['.js', '.mjs', '.css', '.html', '.md', '.json', '.toml', '.yml', '.yaml']);
const failures = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
      continue;
    }
    if (!extensions.has(path.extname(entry.name))) continue;
    const text = await readFile(full, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      if (/\s+$/.test(line) && line.length > 0) {
        failures.push(`${full}:${index + 1} trailing whitespace`);
      }
    });
    if (!text.endsWith('\n')) failures.push(`${full}: missing final newline`);
  }
}

for (const root of roots) await walk(root);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Lint checks passed.');
