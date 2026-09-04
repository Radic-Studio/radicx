import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = 'dist';
const entries = await readdir(root, { withFileTypes: true });
const htmlFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.html')).map((entry) => join(root, entry.name));
const failures = [];

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const requirePattern = (pattern, label) => {
    if (!pattern.test(html)) failures.push(`${file}: missing ${label}`);
  };

  requirePattern(/<html\s+lang="[^"]+"/i, 'document language');
  requirePattern(/<meta\s+name="viewport"/i, 'viewport meta');
  requirePattern(/<main\b/i, 'main landmark');
  requirePattern(/class="[^"]*skip-link/i, 'skip link');
  requirePattern(/:focus-visible|assets\/styles\.css/i, 'focus-visible styling path');

  if (/<dialog\b/i.test(html) && !/(aria-labelledby|aria-label)=/i.test(html)) {
    failures.push(`${file}: dialog requires an accessible name`);
  }

  const imageTags = html.match(/<img\b[^>]*>/gi) ?? [];
  for (const tag of imageTags) {
    if (!/\balt=/i.test(tag)) failures.push(`${file}: image missing alt attribute`);
  }

  const buttonTags = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/gi) ?? [];
  for (const tag of buttonTags) {
    const text = tag.replace(/<[^>]+>/g, '').trim();
    if (!text && !/aria-label=/i.test(tag)) failures.push(`${file}: button missing text or aria-label`);
  }
}

const baseCss = await readFile('dist/assets/design-system/base.css', 'utf8');
if (!/@media\s*\(prefers-reduced-motion:\s*reduce\)/i.test(baseCss)) {
  failures.push('base.css: missing prefers-reduced-motion support');
}
if (!/:focus-visible/i.test(baseCss)) failures.push('base.css: missing visible focus treatment');

if (failures.length) {
  console.error('Accessibility smoke failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Accessibility smoke passed for ${htmlFiles.length} HTML surfaces.`);
