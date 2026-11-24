import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Overrides, RawFile } from '../src/shared/types';
import { collectSensitiveStrings, findLeaks, listFiles } from './lib/privacy';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rawPath = process.argv[2];
if (!rawPath) {
  console.error('Usage: npm run verify:privacy -- <raw json path>');
  process.exit(1);
}

const dirs = [join(root, 'dist'), join(root, 'public', 'data')];
if (!dirs.some((d) => existsSync(d))) {
  console.error('Neither dist/ nor public/data/ exists. Run `npm run build:data && npm run build` first.');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(rawPath, 'utf8')) as RawFile;
const overridesPath = join(root, 'data', 'overrides.json');
const overrides = (existsSync(overridesPath) ? JSON.parse(readFileSync(overridesPath, 'utf8')) : {}) as Overrides;

const sensitive = collectSensitiveStrings(raw, overrides);
const scanned = listFiles(dirs).length;
const leaks = findLeaks(sensitive, dirs);

console.log(`Sensitive strings checked: ${sensitive.length}`);
console.log(`Files scanned: ${scanned}`);
for (const l of leaks) {
  const m = l.match.length > 40 ? l.match.slice(0, 40) : l.match;
  console.log(`${l.file}: "${m}"`);
}
if (leaks.length > 0) {
  console.error(`${leaks.length} leak(s) found.`);
  process.exit(1);
}
console.log('No leaks found.');
