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

  if (/<dialog\b/i.test(html) && !/<dialog\b[^>]*(aria-labelledby|aria-label)=/i.test(html)) {
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

const studyHtml = await readFile('dist/study.html', 'utf8');
if (!/aria-disabled="true"/.test(studyHtml) || !/Weak Areas/.test(studyHtml)) {
  failures.push('study.html: Weak Areas placeholder must expose an unavailable state');
}

const focusHtml = await readFile('dist/focus.html', 'utf8');
if (!/<fieldset\b[^>]*id="answer-options"/i.test(focusHtml) || !/<legend[^>]*>Choose one answer<\/legend>/i.test(focusHtml)) {
  failures.push('focus.html: answer options require a named semantic fieldset');
}
if (!/<fieldset\b[^>]*id="confidence-group"/i.test(focusHtml) || !/How confident are you\?/.test(focusHtml)) {
  failures.push('focus.html: confidence control requires a named semantic fieldset');
}
if (!/id="bookmark-question"[^>]*aria-pressed="false"/i.test(focusHtml)) {
  failures.push('focus.html: bookmark requires an accessible pressed state');
}
if (!/id="study-feedback"[^>]*aria-live="polite"/i.test(focusHtml)) {
  failures.push('focus.html: feedback requires an aria-live announcement region');
}

const studyCss = await readFile('dist/assets/m6/study.css', 'utf8');
if (!/:has\(input:focus-visible\)/.test(studyCss)) failures.push('study.css: answer/confidence controls require visible focus treatment');
if (!/@media \(max-width: 479px\)/.test(studyCss) || !/@media \(min-width: 768px\)/.test(studyCss)) {
  failures.push('study.css: missing approved mobile/tablet responsive validation breakpoints');
}
if (!/@media \(prefers-reduced-motion: reduce\)/.test(studyCss)) {
  failures.push('study.css: missing reduced-motion behavior');
}

if (failures.length) {
  console.error('Accessibility smoke failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Accessibility smoke passed for ${htmlFiles.length} HTML surfaces including M6 Study controls.`);
