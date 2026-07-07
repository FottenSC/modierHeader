import fs from 'node:fs';
import path from 'node:path';

const roots = ['entrypoints', 'src', 'public', 'wxt.config.ts', 'package.json'].filter((root) =>
  fs.existsSync(root),
);

const forbidden = [
  /extensions-hub/i,
  /adsonbread/i,
  /infatica/i,
  /doubleclick/i,
  /googletagmanager/i,
  /google-analytics/i,
  /\btabs\.create\b/i,
  /\bchrome\.tabs\.create\b/i,
  /\bbrowser\.tabs\.create\b/i,
  /setUninstallURL/i,
  /runtime\.setUninstallURL/i,
  /https?:\/\/(?!localhost|127\.0\.0\.1)/i,
];

const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.mjs',
  '.ts',
  '.tsx',
  '.md',
]);

function walk(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(target, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return [fullPath];
  });
}

const findings = [];

for (const root of roots) {
  for (const file of walk(root)) {
    if (!textExtensions.has(path.extname(file))) continue;
    const content = fs.readFileSync(file, 'utf8');
    forbidden.forEach((pattern) => {
      if (pattern.test(content)) {
        findings.push(`${file}: matched ${pattern}`);
      }
    });
  }
}

if (findings.length > 0) {
  console.error('Policy check failed:');
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log('Policy check passed.');
