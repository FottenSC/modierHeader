import fs from 'node:fs';
import path from 'node:path';

const outputRoot = '.output';
const expectedPermissions = [
  'activeTab',
  'declarativeNetRequest',
  'declarativeNetRequestWithHostAccess',
  'storage',
];

function findManifests(root) {
  if (!fs.existsSync(root)) return [];
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) return findManifests(fullPath);
    return entry.name === 'manifest.json' ? [fullPath] : [];
  });
}

const manifests = findManifests(outputRoot);
if (manifests.length === 0) {
  console.error('No built manifest found. Run npm run build first.');
  process.exit(1);
}

for (const manifestPath of manifests) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const permissions = [...(manifest.permissions ?? [])].sort();
  const optionalHosts = manifest.optional_host_permissions ?? [];
  const unexpected = permissions.filter((permission) => !expectedPermissions.includes(permission));
  const missing = expectedPermissions.filter((permission) => !permissions.includes(permission));

  if (manifest.manifest_version !== 3) {
    throw new Error(`${manifestPath}: expected manifest_version 3`);
  }
  if (unexpected.length > 0 || missing.length > 0) {
    throw new Error(
      `${manifestPath}: permission mismatch. Missing=${missing.join(',')} Unexpected=${unexpected.join(',')}`,
    );
  }
  if (manifest.host_permissions?.length) {
    throw new Error(`${manifestPath}: host permissions must be optional, not granted at install`);
  }
  if (!optionalHosts.includes('<all_urls>')) {
    throw new Error(`${manifestPath}: optional_host_permissions must include <all_urls>`);
  }
}

console.log(`Manifest check passed for ${manifests.length} manifest(s).`);
