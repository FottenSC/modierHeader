import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.resolve('.output');
const files = (await readdir(outputDir))
  .filter((file) => file.endsWith('.zip'))
  .sort();

if (files.length === 0) {
  throw new Error('No release zip files found in .output. Run npm run zip and npm run zip:edge first.');
}

const lines = [];

for (const file of files) {
  const body = await readFile(path.join(outputDir, file));
  const hash = createHash('sha256').update(body).digest('hex');
  lines.push(`${hash}  ${file}`);
}

await writeFile(path.join(outputDir, 'SHA256SUMS'), `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
