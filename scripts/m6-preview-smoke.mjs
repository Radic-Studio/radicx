import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const distRoot = path.resolve('dist');
const failures = [];
const textExtensions = new Set(['.html', '.js', '.css', '.json', '.txt']);
const requiredRoutes = [
  'index.html',
  'login.html',
  'student.html',
  'study.html',
  'focus.html'
];
const forbiddenBuildSecrets = [
  [/Synthetic private explanation for automated/i, 'known private seed explanation'],
  [/\bsb_secret_[a-z0-9_-]+/i, 'Supabase secret key'],
  [/DATABASE_PASSWORD/i, 'database password variable'],
  [/SUPABASE_SERVICE_ROLE/i, 'Supabase service-role variable']
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

function normalizeReference(reference, relativeFile) {
  const withoutFragment = reference.split('#', 1)[0].split('?', 1)[0];
  if (!withoutFragment || /^(?:[a-z]+:|\/\/|#)/i.test(reference)) return null;
  const relative = withoutFragment.startsWith('/')
    ? withoutFragment.slice(1)
    : path.posix.normalize(path.posix.join(path.posix.dirname(relativeFile), withoutFragment));
  if (!relative) return 'index.html';
  return relative.endsWith('/') ? `${relative}index.html` : relative;
}

function collectHtmlReferences(content, relativeFile) {
  return [...content.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)]
    .map((match) => normalizeReference(match[1], relativeFile))
    .filter(Boolean);
}

function collectCssReferences(content, relativeFile) {
  return [...content.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)]
    .map((match) => normalizeReference(match[1], relativeFile))
    .filter(Boolean);
}

function collectModuleReferences(content, relativeFile) {
  const parent = path.posix.dirname(relativeFile.replaceAll('\\', '/'));
  return [...content.matchAll(/(?:\bfrom\s*|\bimport\s*\()["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((reference) => reference.startsWith('.'))
    .map((reference) => path.posix.normalize(path.posix.join(parent, reference)));
}

const allFiles = await walk(distRoot);
const relativeFiles = new Set(allFiles.map((file) => path.relative(distRoot, file).replaceAll('\\', '/')));
const textFiles = allFiles.filter((file) => textExtensions.has(path.extname(file).toLowerCase()));

for (const required of requiredRoutes) {
  if (!relativeFiles.has(required)) failures.push(`${required}: missing from deterministic build`);
}

for (const relative of relativeFiles) {
  if (/\.map$/i.test(relative)) failures.push(`${relative}: public source map is not approved for M6`);
}

const artifactHash = createHash('sha256');
for (const file of [...textFiles].sort()) {
  const relative = path.relative(distRoot, file).replaceAll('\\', '/');
  const content = await readFile(file, 'utf8');
  artifactHash.update(relative);
  artifactHash.update('\0');
  artifactHash.update(content);
  artifactHash.update('\0');

  for (const [pattern, label] of forbiddenBuildSecrets) {
    if (pattern.test(content)) failures.push(`${relative}: contains ${label}`);
  }

  const studyBrowserFile = /(?:^|\/)assets\/m6\/|^(?:study|focus)\.html$/.test(relative);
  if (studyBrowserFile && /private\.question_keys|\.from\(['"]question_keys['"]\)/i.test(content)) {
    failures.push(`${relative}: Study browser code addresses the private answer-key store`);
  }
  if (studyBrowserFile && /\.from\(['"]questions['"]\)/i.test(content)) {
    failures.push(`${relative}: Study browser code bypasses the safe Study RPC boundary`);
  }

  const extension = path.extname(file).toLowerCase();
  const references = extension === '.html'
    ? collectHtmlReferences(content, relative)
    : extension === '.css'
      ? collectCssReferences(content, relative)
      : extension === '.js'
        ? collectModuleReferences(content, relative)
        : [];

  for (const reference of references) {
    if (!relativeFiles.has(reference)) failures.push(`${relative}: local asset reference is missing: ${reference}`);
  }
}

const runtimeConfigPath = path.join(distRoot, 'assets', 'runtime-config.js');
const runtimeConfigText = await readFile(runtimeConfigPath, 'utf8');
const runtimeMatch = runtimeConfigText.match(/^window\.__RADICX_CONFIG__\s*=\s*Object\.freeze\((\{.*\})\);\s*$/s);
if (!runtimeMatch) {
  failures.push('assets/runtime-config.js: does not use the approved frozen public configuration shape');
} else {
  try {
    const runtimeConfig = JSON.parse(runtimeMatch[1]);
    const keys = Object.keys(runtimeConfig).sort();
    if (keys.join(',') !== 'supabasePublishableKey,supabaseUrl') {
      failures.push(`assets/runtime-config.js: unapproved configuration keys: ${keys.join(', ')}`);
    }
    if (runtimeConfig.supabaseUrl && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(runtimeConfig.supabaseUrl)) {
      failures.push('assets/runtime-config.js: Supabase URL is not an approved HTTPS project origin');
    }
    if (runtimeConfig.supabasePublishableKey
        && !/^(?:sb_publishable_[a-z0-9_-]+|eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+)$/i.test(runtimeConfig.supabasePublishableKey)) {
      failures.push('assets/runtime-config.js: Supabase browser key is not a publishable/legacy anon key');
    }
    if (/service[_-]?role|sb_secret_|database_password|serviceRole|secretKey|databasePassword/i.test(runtimeConfigText)) {
      failures.push('assets/runtime-config.js: contains an unapproved privileged configuration field');
    }
  } catch {
    failures.push('assets/runtime-config.js: public configuration is not valid JSON');
  }
}

if (failures.length) {
  console.error('M6 deterministic preview artifact smoke failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `M6 deterministic preview artifact smoke passed across ${textFiles.length} text assets; `
  + `artifact SHA-256 ${artifactHash.digest('hex')}.`
);
