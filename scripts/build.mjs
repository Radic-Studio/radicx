import { cp, mkdir, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public/index.html', 'dist/index.html');
await cp('src/app.js', 'dist/app.js');
await cp('src/styles.css', 'dist/styles.css');

console.log('RadicX M1 build complete.');
