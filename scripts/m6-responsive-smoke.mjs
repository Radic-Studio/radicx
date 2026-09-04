import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const widths = [360, 390, 412, 430, 480, 768, 1024, 1440];
const surfaces = ['study.html', 'focus.html'];
const chromeCandidates = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
let chrome = null;

for (const candidate of chromeCandidates) {
  try {
    execFileSync(candidate, ['--version'], { stdio: 'ignore' });
    chrome = candidate;
    break;
  } catch {
    // Try the next runner/browser binary.
  }
}

if (!chrome) {
  throw new Error('M6 responsive smoke requires a headless Chromium/Chrome binary on the CI runner.');
}

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'radicx-m6-responsive-'));
const failures = [];

try {
  for (const surface of surfaces) {
    let html = await readFile(path.join('dist', surface), 'utf8');
    html = html
      .replace('data-auth-state="loading"', 'data-auth-state="authenticated"')
      .replace('href="/assets/styles.css"', `href="${path.resolve('dist/assets/styles.css').replaceAll('\\', '/')}"`)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<script\b[^>]*><\/script>/gi, '')
      .replace(/<script\b[^>]*\/?>/gi, '')
      .replace('</body>', '<script>document.documentElement.dataset.m6Overflow = document.documentElement.scrollWidth > window.innerWidth ? "yes" : "no";</script></body>');

    const fixture = path.join(tempDir, surface);
    await writeFile(fixture, html, 'utf8');

    for (const width of widths) {
      const output = execFileSync(chrome, [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--allow-file-access-from-files',
        `--window-size=${width},900`,
        '--virtual-time-budget=500',
        '--dump-dom',
        `file://${fixture}`
      ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

      if (!/data-m6-overflow="no"/.test(output)) {
        failures.push(`${surface} overflows horizontally at ${width}px`);
      }
    }
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

if (failures.length) {
  console.error('M6 responsive smoke failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`M6 responsive smoke passed for ${surfaces.length} Study surfaces across ${widths.join(', ')}px widths.`);
