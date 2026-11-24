import { describe, expect, it } from 'vitest';
import raw from './fixtures/raw-mini.json';
import type { RawFile } from '../src/shared/types';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { sanitize } from '../scripts/lib/sanitize';
import { buildData } from '../scripts/lib/build-data';
import { collectSensitiveStrings, findLeaks } from '../scripts/lib/privacy';

const rawFile = raw as RawFile;
const tmp = () => mkdtempSync(join(tmpdir(), 'privacy-'));

describe('collectSensitiveStrings', () => {
  it('includes places of living people', () => {
    const s = collectSensitiveStrings(rawFile, {});
    expect(s).toContain('Scranton PA');
    expect(s).toContain('English Village');
    expect(s).toContain('Palmyra PA');
    expect(s).toContain('Advertising Copywriter');
  });

  it('excludes strings that also occur on deceased people', () => {
    const copy: RawFile = JSON.parse(JSON.stringify(rawFile));
    const dead = copy.individuals.find((i) => i.id === 'I2')!;
    dead.events.push({ type: 'RESI', label: 'Resided', year: 1950, place: 'English Village' });
    const s = collectSensitiveStrings(copy, {});
    expect(s).not.toContain('English Village');
    expect(s).toContain('Scranton PA');
  });

  it('does not include birth year strings or empties', () => {
    const s = collectSensitiveStrings(rawFile, {});
    expect(s).not.toContain('1948');
    expect(s).not.toContain('');
    expect(new Set(s).size).toBe(s.length);
  });
});

describe('findLeaks', () => {
  it('finds a planted file', () => {
    const d = tmp();
    mkdirSync(join(d, 'sub'));
    writeFileSync(join(d, 'sub', 'a.json'), 'x English Village y');
    writeFileSync(join(d, 'b.json'), 'clean');
    const leaks = findLeaks(['English Village'], [d, join(d, 'missing')]);
    expect(leaks).toEqual([{ file: join(d, 'sub', 'a.json'), match: 'English Village' }]);
  });

  it('reports none on sanitized build output', () => {
    const d = tmp();
    const files = buildData(sanitize(rawFile, {}).file);
    for (const [p, v] of files) {
      const full = join(d, p);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, JSON.stringify(v));
    }
    const s = collectSensitiveStrings(rawFile, {});
    expect(s.length).toBeGreaterThan(0);
    expect(findLeaks(s, [d])).toEqual([]);
  });

  it('negative control: raw fixture is detected as leaking', () => {
    const d = tmp();
    writeFileSync(join(d, 'raw.json'), JSON.stringify(rawFile));
    const s = collectSensitiveStrings(rawFile, {});
    expect(findLeaks(s, [d]).length).toBeGreaterThan(0);
  });
});
