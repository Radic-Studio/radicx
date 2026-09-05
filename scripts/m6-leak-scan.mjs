import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const roots = ['dist'];
const failures = [];
const forbiddenBuildSecrets = [
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
  for (const [pattern, label] of forbiddenBuildSecrets) {
    if (pattern.test(content)) failures.push(`${file}: contains ${label}`);
  }
}

const studyBrowserFiles = files.filter((file) => /(?:\/m6\/|\/study\.html$|\/focus\.html$)/.test(file.replaceAll('\\', '/')));
for (const file of studyBrowserFiles) {
  if (!/\.(?:html|js)$/i.test(file)) continue;
  const content = await readFile(file, 'utf8');
  if (/private\.question_keys|\.from\(['"]question_keys['"]\)/i.test(content)) {
    failures.push(`${file}: Study browser code attempts to address the private answer-key store`);
  }
  if (/\.from\(['"]questions['"]\)/i.test(content)) {
    failures.push(`${file}: Study browser code bypasses the safe Study RPC boundary with a direct questions-table read`);
  }
}

const runtimeConfig = await readFile('dist/assets/runtime-config.js', 'utf8');
if (!/supabaseUrl/.test(runtimeConfig) || !/supabasePublishableKey/.test(runtimeConfig)) {
  failures.push('dist/assets/runtime-config.js: missing the approved public Supabase config shape');
}
if (/service[_-]?role|sb_secret_|database_password/i.test(runtimeConfig)) {
  failures.push('dist/assets/runtime-config.js: contains privileged configuration');
}

if (failures.length) {
  console.error('M6 browser leak scan failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`M6 browser leak scan passed across ${files.length} built files and ${studyBrowserFiles.length} Study browser files.`);
