import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Overrides, RawFile } from '../src/shared/types';
import type { PublicFile } from '../src/shared/types';
import { checkPublicFile } from './lib/check-public';
import { MIN_SUBSTRING_LENGTH, collectSensitive, findLeaks, listFiles } from './lib/privacy';

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

const { strings: sensitive, excludedCount } = collectSensitive(raw, overrides);
const scanned = listFiles(dirs).length;
const leaks = findLeaks(sensitive, dirs);

console.log(`Sensitive strings checked: ${sensitive.length}`);
console.log(`Files scanned: ${scanned}`);
console.log(
  `${excludedCount} strings skipped because deceased people share them (a living person's detail published under one of those strings would not be detected)`,
);
console.log(
  `Matching: parsed .json files by exact string value; other files by substring (strings of ${MIN_SUBSTRING_LENGTH}+ characters, not only digits or punctuation).`,
);
const publicPath = join(root, 'data', 'family.public.json');
let structural = 0;
if (existsSync(publicPath)) {
  const problems = checkPublicFile(JSON.parse(readFileSync(publicPath, 'utf8')) as PublicFile, overrides);
  structural = problems.length;
  console.log(`Structural problems in data/family.public.json: ${structural}`);
  for (const p of problems.slice(0, 20)) console.log(`  ${p}`);
} else {
  console.log('data/family.public.json not found; structural check skipped.');
}
for (const l of leaks) {
  const m = l.match.length > 40 ? l.match.slice(0, 40) : l.match;
  console.log(`${l.file}: "${m}"`);
}
if (leaks.length > 0 || structural > 0) {
  console.error(`${leaks.length} leak(s) and ${structural} structural problem(s) found.`);
  process.exit(1);
}
console.log('No leaks found.');
