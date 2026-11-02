// Zips the built extension (dist/) into the file the web app's Extension page offers for download.
// Run it through `npm run package`, which builds first. The addresses in .env are baked into the
// build, so point them at the real servers before packaging a release.

import AdmZip from 'adm-zip';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const output = resolve(root, '../frontend/public/PassHavenWeb.zip');

if (!existsSync(resolve(dist, 'manifest.json'))) {
  throw new Error('dist/ is empty. Run `npm run build` first (or use `npm run package`).');
}

const zip = new AdmZip();
zip.addLocalFolder(dist); // manifest.json at the top of the zip, as people expect when they unzip it
zip.writeZip(output);

console.log(`Wrote ${output}`);
