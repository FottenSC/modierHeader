import JSZip from 'jszip';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import packageJson from '../package.json' with { type: 'json' };

const browser = process.argv[2] ?? 'chrome';
const sourceDir = path.resolve('.output', `${browser}-mv3`);
const outputFile = path.resolve('.output', `modierheaders-${packageJson.version}-${browser}.zip`);
const fixedDate = new Date('1980-01-01T00:00:00Z');

async function listFiles(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolutePath, base)));
    } else if (entry.isFile()) {
      files.push({
        absolutePath,
        zipPath: path.relative(base, absolutePath).replaceAll(path.sep, '/'),
      });
    }
  }

  return files;
}

const zip = new JSZip();
const files = await listFiles(sourceDir);

for (const file of files) {
  zip.file(file.zipPath, await readFile(file.absolutePath), {
    createFolders: false,
    date: fixedDate,
    unixPermissions: 0o100644,
  });
}

const body = await zip.generateAsync({
  type: 'nodebuffer',
  compression: 'STORE',
  platform: 'UNIX',
});

await mkdir(path.dirname(outputFile), { recursive: true });
await rm(outputFile, { force: true });
await writeFile(outputFile, body);
console.log(`${path.relative(process.cwd(), outputFile)} ${body.length} bytes`);
