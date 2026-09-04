import { cp, mkdir, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/assets', { recursive: true });
await cp('public', 'dist', { recursive: true });
await cp('src', 'dist/assets', { recursive: true });

console.log('RadicX M4 question-intelligence build complete.');
