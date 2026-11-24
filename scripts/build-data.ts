import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PublicFile } from '../src/shared/types';
import { buildData } from './lib/build-data';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const input = join(root, 'data', 'family.public.json');
if (!existsSync(input)) {
  console.error('data/family.public.json not found. Run `npm run sanitize -- <raw export path>` first.');
  process.exit(1);
}

const pub = JSON.parse(readFileSync(input, 'utf8')) as PublicFile;
const files = buildData(pub);
const outDir = join(root, 'public', 'data');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

let largest = { path: '', size: 0 };
for (const [path, value] of files) {
  const text = JSON.stringify(value);
  const full = join(outDir, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
  const size = Buffer.byteLength(text);
  if (size > largest.size) largest = { path, size };
}
console.log(`Wrote ${files.size} files to public/data/`);
console.log(`Largest: ${largest.path} (${(largest.size / 1024).toFixed(1)} KB)`);
