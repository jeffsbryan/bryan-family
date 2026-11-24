import { describe, expect, it } from 'vitest';
import raw from './fixtures/raw-mini.json';
import type { RawFile } from '../src/shared/types';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { sanitize } from '../scripts/lib/sanitize';
import { buildData } from '../scripts/lib/build-data';
import { collectSensitive, collectSensitiveStrings, findLeaks } from '../scripts/lib/privacy';

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

describe('findLeaks precision', () => {
  const mk = (livingEvents: object[], deadEvents: object[] = []): RawFile => ({
    format: 'x',
    individuals: [
      {
        id: 'L1', name: 'Zed Livingman', givenName: 'Zed', surname: 'Livingman', sex: 'M',
        events: [{ type: 'BIRT', label: 'Born', year: 1960 }, ...livingEvents] as RawFile['individuals'][0]['events'],
        childOfFamilies: [], spouseOfFamilies: [],
      },
      {
        id: 'D1', name: 'Old Person', givenName: 'Old', surname: 'Person', sex: 'F',
        events: [{ type: 'BIRT', label: 'Born', year: 1900 }, ...deadEvents] as RawFile['individuals'][0]['events'],
        childOfFamilies: [], spouseOfFamilies: [],
      },
    ],
    families: [],
  });
  const scan = (r: RawFile, name: string, content: string) => {
    const d = tmp();
    writeFileSync(join(d, name), content);
    return findLeaks(collectSensitiveStrings(r, {}), [d]);
  };

  it('a living "1950" is not a leak inside a deceased "5 MAR 1950"', () => {
    const r = mk([{ type: 'RESI', label: 'Resided', date: '1950' }], [{ type: 'RESI', label: 'Resided', date: '5 MAR 1950' }]);
    expect(scan(r, 'out.json', JSON.stringify({ d: '5 MAR 1950' }))).toEqual([]);
  });

  it('a living place equal to a whole JSON string value is a leak', () => {
    const r = mk([{ type: 'RESI', label: 'Resided', place: 'Hidden Hollow' }]);
    const leaks = scan(r, 'out.json', JSON.stringify({ a: [{ place: 'Hidden Hollow' }] }));
    expect(leaks.map((l) => l.match)).toEqual(['Hidden Hollow']);
  });

  it('a living place only inside a longer deceased string is not a leak', () => {
    const r = mk([{ type: 'RESI', label: 'Resided', place: 'Hidden Hollow' }], [{ type: 'RESI', label: 'Resided', place: 'Hidden Hollow, Ohio' }]);
    expect(scan(r, 'out.json', JSON.stringify({ p: 'Hidden Hollow, Ohio' }))).toEqual([]);
    const r2 = mk([{ type: 'RESI', label: 'Resided', place: 'Hidden Hollow' }]);
    expect(scan(r2, 'out.json', JSON.stringify({ p: 'Near Hidden Hollow, Ohio' }))).toEqual([]);
  });

  it('short strings are not flagged in a bundle .js but long ones are', () => {
    const r = mk([
      { type: 'RESI', label: 'Resided', place: 'Reno' },
      { type: 'RESI', label: 'Resided', place: 'Twelve Chars' },
    ]);
    expect(scan(r, 'bundle.js', 'var a="Reno, Nevada";').map((l) => l.match)).toEqual([]);
    expect(scan(r, 'bundle.js', 'var a="Twelve Chars";').map((l) => l.match)).toEqual(['Twelve Chars']);
  });

  it('purely numeric strings are not substring-matched in non-JSON files', () => {
    const r = mk([{ type: 'RESI', label: 'Resided', date: '19500101' }]);
    expect(scan(r, 'bundle.js', 'const x=19500101;')).toEqual([]);
  });
});

describe('collectSensitiveStrings expansion and exclusion count', () => {
  const mk = (places: string[], deadPlaces: string[] = []): RawFile => ({
    format: 'x',
    individuals: [
      {
        id: 'L1', name: 'Zed Livingman', givenName: 'Zed', surname: 'Livingman', sex: 'M',
        events: [
          { type: 'BIRT', label: 'Born', year: 1960 },
          ...places.map((place) => ({ type: 'RESI', label: 'Resided', place })),
        ],
        childOfFamilies: [], spouseOfFamilies: [],
      },
      {
        id: 'D1', name: 'Old Person', givenName: 'Old', surname: 'Person', sex: 'F',
        events: [
          { type: 'BIRT', label: 'Born', year: 1900 },
          ...deadPlaces.map((place) => ({ type: 'RESI', label: 'Resided', place })),
        ],
        childOfFamilies: [], spouseOfFamilies: [],
      },
    ],
    families: [],
  });
  const leakIn = (raw: RawFile, content: string) => {
    const d = tmp();
    writeFileSync(join(d, 'out.json'), content);
    return findLeaks(collectSensitiveStrings(raw, {}), [d]);
  };

  it('detects normalized form of "Scranton PA, USA"', () => {
    expect(leakIn(mk(['Scranton PA, USA']), '{"p":"Scranton PA"}').length).toBeGreaterThan(0);
  });

  it('detects JSON-escaped form of a place with quotes', () => {
    const place = 'Café "X"';
    expect(leakIn(mk([place]), JSON.stringify({ p: place })).length).toBeGreaterThan(0);
  });

  it('detects NFC form of an NFD place', () => {
    const nfd = 'Café Town';
    expect(leakIn(mk([nfd]), 'Café Town').length).toBeGreaterThan(0);
  });

  it('detects collapsed form of a double-spaced place', () => {
    expect(leakIn(mk(['Old  Mill  Rd']), 'Old Mill Rd').length).toBeGreaterThan(0);
  });

  it('does not flag a living person name', () => {
    expect(leakIn(mk(['Hidden Place']), 'Zed Livingman Zed Livingman').length).toBe(0);
  });

  it('counts strings skipped because deceased people share them', () => {
    const none = collectSensitive(mk(['Hidden Place', 'Shared Town']), {});
    expect(none.excludedCount).toBe(0);
    const r = collectSensitive(mk(['Hidden Place', 'Shared Town'], ['Shared Town']), {});
    expect(r.excludedCount).toBe(1);
    expect(r.strings).toContain('Hidden Place');
    expect(r.strings).not.toContain('Shared Town');
  });
});
