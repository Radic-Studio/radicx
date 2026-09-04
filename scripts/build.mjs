import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/assets', { recursive: true });
await cp('public', 'dist', { recursive: true });
await cp('src', 'dist/assets', { recursive: true });

const runtimeConfig = {
  supabaseUrl: String(process.env.PUBLIC_SUPABASE_URL ?? '').trim(),
  supabasePublishableKey: String(process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '').trim()
};

await writeFile(
  'dist/assets/runtime-config.js',
  `window.__RADICX_CONFIG__ = Object.freeze(${JSON.stringify(runtimeConfig)});\n`,
  'utf8'
);

console.log('RadicX M5 authentication and onboarding build complete.');
