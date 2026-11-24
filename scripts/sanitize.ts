import { existsSync } from 'node:fs';
import { sanitizeFile } from './lib/sanitize';

const rawPath = process.argv[2];
if (!rawPath) {
  console.error('Usage: tsx scripts/sanitize.ts <path-to-raw-gedcom.json>');
  process.exit(1);
}
if (!existsSync(rawPath)) {
  console.error(`Cannot read raw file: ${rawPath}`);
  process.exit(1);
}

try {
  const r = sanitizeFile(rawPath, 'data/family.public.json', 'data/overrides.json');
  console.log('Wrote data/family.public.json');
  console.log(`living: ${r.living}`);
  console.log(`livingWithDeathRecord: ${r.livingWithDeathRecord}`);
  console.log(`overridesApplied: ${r.overridesApplied}`);
  console.log(`born 1926-1940 with no death record: ${r.bornAfter1925UpTo1940NoDeath.length}`);
  for (const p of r.bornAfter1925UpTo1940NoDeath) console.log(`  ${p.id}  ${p.name}`);
} catch (err) {
  console.error(`Sanitize failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
