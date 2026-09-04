import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

const files = await walk('dist');
let total = 0;
const records = [];
for (const file of files) {
  const info = await stat(file);
  total += info.size;
  records.push({ file: relative('dist', file), bytes: info.size });
}
records.sort((a, b) => b.bytes - a.bytes);

const assetBytes = records.filter((record) => /^(assets\/).+\.(css|js)$/i.test(record.file)).reduce((sum, record) => sum + record.bytes, 0);
const totalBudget = 300 * 1024;
const cssJsBudget = 180 * 1024;

console.log(`M3 bundle baseline: ${total} bytes total; ${assetBytes} bytes CSS/JS.`);
for (const record of records.slice(0, 12)) console.log(`${record.bytes.toString().padStart(8)}  ${record.file}`);

if (total > totalBudget) {
  console.error(`Total build exceeds M3 baseline budget of ${totalBudget} bytes.`);
  process.exit(1);
}
if (assetBytes > cssJsBudget) {
  console.error(`CSS/JS exceeds M3 baseline budget of ${cssJsBudget} bytes.`);
  process.exit(1);
}
