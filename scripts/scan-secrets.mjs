import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const excludedDirs = new Set(['.git', 'node_modules', 'dist', '.netlify']);
const excludedFiles = new Set(['scripts/scan-secrets.mjs']);
const patterns = [
  { name: 'private key', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'Supabase service-role token marker', regex: /service_role[^\n]{0,40}(?:eyJ|[A-Za-z0-9_-]{24,})/i },
  { name: 'Paystack live secret', regex: /sk_live_[A-Za-z0-9]+/ },
  { name: 'generic bearer token', regex: /Bearer\s+[A-Za-z0-9._-]{24,}/i }
];

const findings = [];

async function walk(dir = '.') {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const normalized = full.replace(/^\.\//, '').replaceAll('\\', '/');
    if (entry.isDirectory()) {
      if (!excludedDirs.has(entry.name)) await walk(full);
      continue;
    }
    if (excludedFiles.has(normalized)) continue;
    if (/\.(png|jpe?g|gif|ico|zip|pdf)$/i.test(entry.name)) continue;
    let text;
    try {
      text = await readFile(full, 'utf8');
    } catch {
      continue;
    }
    for (const pattern of patterns) {
      if (pattern.regex.test(text)) findings.push(`${normalized}: ${pattern.name}`);
    }
  }
}

await walk();

if (findings.length) {
  console.error(`Potential secrets detected:\n${findings.join('\n')}`);
  process.exit(1);
}

console.log('Secret scan passed.');
