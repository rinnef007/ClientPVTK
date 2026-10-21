// Copies the game's assets/ folder(s) into public/assets/ and writes a manifest for the viewer.
// The art is third-party copyrighted: public/assets/ is gitignored and must stay local.
//
// Usage: node scripts/import-assets.mjs <dir> [<dir> ...]
//   Each <dir> is either an `assets/` folder or a folder that contains one
//   (e.g. the extracted images_part1/ and images_part2/ zips, or an unzipped APK).
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const dest = fileURLToPath(new URL('../public/assets/', import.meta.url));
const srcs = process.argv.slice(2);
if (!srcs.length) {
  console.error('usage: node scripts/import-assets.mjs <dir> [<dir> ...]');
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
for (const s of srcs) {
  const root = existsSync(join(s, 'assets')) ? join(s, 'assets') : s;
  if (!statSync(root).isDirectory()) throw new Error(`not a directory: ${root}`);
  cpSync(root, dest, { recursive: true });
  console.log(`copied ${root}`);
}

// Numeric file names sort numerically so frame sequences play in order.
const collator = new Intl.Collator('en', { numeric: true });
const dirs = {};
(function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => collator.compare(a.name, b.name));
  const files = [];
  for (const e of entries) {
    if (e.isDirectory()) walk(join(dir, e.name));
    else if (e.name !== 'manifest.json') files.push(e.name);
  }
  const rel = relative(dest, dir).split(sep).join('/');
  if (files.length) dirs[rel || '.'] = files;
})(dest);

writeFileSync(join(dest, 'manifest.json'), JSON.stringify({ dirs }));
const total = Object.values(dirs).reduce((n, f) => n + f.length, 0);
console.log(`manifest: ${Object.keys(dirs).length} dirs, ${total} files → public/assets/manifest.json`);
