import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const base = String(process.env.M6_PREVIEW_URL ?? '').replace(/\/+$/, '');
if (!/^https:\/\/deploy-preview-\d+--radicx\.netlify\.app$/.test(base)) {
  throw new Error('M6_PREVIEW_URL must be the RadicX Netlify Deploy Preview HTTPS origin.');
}

const distRoot = path.resolve('dist');
const textExtensions = new Set(['.html', '.js', '.css', '.json', '.txt']);
const forbiddenBuildSecrets = [
  [/Synthetic private explanation for automated/i, 'known private seed explanation'],
  [/\bsb_secret_[a-z0-9_-]+/i, 'Supabase secret key'],
  [/DATABASE_PASSWORD/i, 'database password variable']
];

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

async function fetchText(relativePath) {
  const url = `${base}/${relativePath.split(path.sep).map(encodeURIComponent).join('/')}`;
  const response = await fetch(url, { redirect: 'follow', cache: 'no-store' });
  const body = await response.text();
  return { url, status: response.status, body };
}

const localFiles = (await walk(distRoot))
  .filter((file) => textExtensions.has(path.extname(file).toLowerCase()))
  .map((file) => ({ file, relative: path.relative(distRoot, file) }));

const failures = [];
let checked = 0;
for (const entry of localFiles) {
  const remote = await fetchText(entry.relative);
  if (remote.status !== 200) {
    failures.push(`${entry.relative}: preview returned HTTP ${remote.status}`);
    continue;
  }
  checked += 1;

  for (const [pattern, label] of forbiddenBuildSecrets) {
    if (pattern.test(remote.body)) failures.push(`${entry.relative}: contains ${label}`);
  }

  const normalized = entry.relative.replaceAll('\\', '/');
  const studyBrowserFile = /(?:^|\/)assets\/m6\/|^(?:study|focus)\.html$/.test(normalized);
  if (studyBrowserFile && /private\.question_keys|\.from\(['"]question_keys['"]\)/i.test(remote.body)) {
    failures.push(`${entry.relative}: Study browser code addresses the private answer-key store`);
  }
  if (studyBrowserFile && /\.from\(['"]questions['"]\)/i.test(remote.body)) {
    failures.push(`${entry.relative}: Study browser code bypasses the safe Study RPC boundary`);
  }

  if (entry.relative === path.join('assets', 'runtime-config.js')) {
    if (!/supabaseUrl/.test(remote.body) || !/supabasePublishableKey/.test(remote.body)) {
      failures.push('assets/runtime-config.js: missing approved public Supabase configuration shape');
    }
    if (/service[_-]?role|sb_secret_|database_password|serviceRole|secretKey|databasePassword/i.test(remote.body)) {
      failures.push('assets/runtime-config.js: contains an unapproved privileged configuration field');
    }
    continue;
  }

  const localBody = await readFile(entry.file, 'utf8');
  if (sha256(remote.body) !== sha256(localBody)) {
    failures.push(`${entry.relative}: hosted preview differs from the deterministic current-head build`);
  }
}

const mapCandidates = localFiles
  .filter((entry) => ['.js', '.css'].includes(path.extname(entry.relative).toLowerCase()))
  .map((entry) => `${entry.relative}.map`);
for (const relative of mapCandidates) {
  const remote = await fetchText(relative);
  if (remote.status === 200) failures.push(`${relative}: public source map is exposed`);
}

for (const required of ['study.html', 'focus.html', 'student.html']) {
  if (!localFiles.some((entry) => entry.relative === required)) {
    failures.push(`${required}: missing from deterministic build`);
  }
}

if (failures.length) {
  console.error('M6 Netlify Deploy Preview smoke failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`M6 Netlify Deploy Preview integrity/leak smoke passed across ${checked} hosted text assets; no public source maps were exposed.`);
