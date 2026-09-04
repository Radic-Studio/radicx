import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const roots = ['dist'];
const failures = [];
const forbidden = [
  [/private\.question_keys/i, 'private answer-key table reference'],
  [/\bservice[_-]?role\b/i, 'service-role credential/reference'],
  [/\bsb_secret_[a-z0-9_-]+/i, 'Supabase secret key'],
  [/DATABASE_PASSWORD/i, 'database password variable'],
  [/Synthetic private explanation for automated/i, 'known private seed explanation']
];

async function walk(target) {
  const info = await stat(target);
  if (info.isFile()) return [target];
  const files = [];
  for (const entry of await readdir(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

const files = [];
for (const root of roots) files.push(...await walk(root));

for (const file of files) {
  if (/\.map$/i.test(file)) {
    failures.push(`${file}: public source map is not approved for M6`);
    continue;
  }
  if (!/\.(?:html|js|css|json|txt)$/i.test(file)) continue;
  const content = await readFile(file, 'utf8');
  for (const [pattern, label] of forbidden) {
    if (pattern.test(content)) failures.push(`${file}: contains ${label}`);
  }
}

const runtimeConfig = await readFile('dist/assets/runtime-config.js', 'utf8');
if (!/supabaseUrl/.test(runtimeConfig) || !/supabasePublishableKey/.test(runtimeConfig)) {
  failures.push('dist/assets/runtime-config.js: missing the approved public Supabase config shape');
}

if (failures.length) {
  console.error('M6 browser leak scan failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`M6 browser leak scan passed across ${files.length} built files.`);
