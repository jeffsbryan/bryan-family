import { describe, expect, it } from 'vitest';
import raw from './fixtures/raw-mini.json';
import type { Manifest, PublicFamily, PublicPerson, RawFile, SearchEntry } from '../src/shared/types';
import { sanitize } from '../scripts/lib/sanitize';
import { buildData } from '../scripts/lib/build-data';

const pub = sanitize(raw as RawFile, {}).file;
const now = new Date('2026-01-02T03:04:05.000Z');
const out = buildData(pub, now);
const get = <T>(p: string) => out.get(p) as T;

describe('buildData', () => {
  it('buckets people with cleaned events', () => {
    const p = get<Record<string, PublicPerson>>('people/4.json')['I4'];
    const resi = p.events.filter((e) => e.type === 'RESI');
    expect(resi).toHaveLength(1);
    expect(resi[0].year).toBe(1910);
    expect(resi[0].place).not.toContain('United States');
  });

  it('buckets families', () => {
    expect(get<Record<string, PublicFamily>>('families/4.json')['F4']).toBeDefined();
  });

  it('builds search shards', () => {
    const br = get<SearchEntry[]>('search/br.json');
    expect(br.length).toBeGreaterThan(1);
    expect(br).toContainEqual(['I1', 'Stephen Thomas Bryan', null, null, true, null]);
    expect(get<SearchEntry[]>('search/ma.json')).toContainEqual(['I8', 'Mary', null, null, false, null]);
    expect(get<SearchEntry[]>('search/st.json').map((e) => e[0])).toContain('I1');
    expect(get<SearchEntry[]>('search/__.json').map((e) => e[0])).toContain('I8');
    expect(get<SearchEntry[]>('search/ma.json').map((e) => e[0])).toContain('I8');
  });

  it('search entries carry the trimmed birth place; living entries have none', () => {
    const entries = [...out].filter(([p]) => p.startsWith('search/')).flatMap(([, v]) => v as SearchEntry[]);
    const find = (id: string) => entries.find((e) => e[0] === id)!;
    expect(find('I4')).toEqual(['I4', 'Oliver Bryan', 1870, 1931, false, 'New Haven CT']);
    for (const e of entries.filter((x) => x[4])) {
      expect(e.slice(2)).toEqual([null, null, true, null]);
    }
  });

  it('cuts the place to two parts, normalized, and uses birthYear() for the year', () => {
    const file = sanitize(
      {
        format: 'x',
        individuals: [
          {
            id: 'I50', name: 'Ann Test', givenName: 'Ann', surname: 'Test', sex: 'F',
            events: [
              { type: 'BIRT', label: 'Born', date: 'Abt 1850', place: 'Hartford, Hartford, Connecticut, United States' },
              { type: 'DEAT', label: 'Died', year: 1900 },
            ],
            childOfFamilies: [], spouseOfFamilies: [],
          },
        ],
        families: [],
      },
      {},
    ).file;
    const entry = (buildData(file).get('search/te.json') as SearchEntry[])[0];
    expect(entry).toEqual(['I50', 'Ann Test', 1850, 1900, false, 'Hartford, Hartford']);
  });

  it('has no duplicate ids per shard and sorts by name then id', () => {
    for (const [path, v] of out) {
      if (!path.startsWith('search/')) continue;
      const es = v as SearchEntry[];
      expect(new Set(es.map((e) => e[0])).size).toBe(es.length);
      const sorted = [...es].sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));
      expect(es.map((e) => e[0])).toEqual(sorted.map((e) => e[0]));
    }
  });

  it('builds the manifest', () => {
    const m = get<Manifest>('manifest.json');
    expect(m.generatedAt).toBe(now.toISOString());
    expect(m.bucketCount).toBe(200);
    expect(m.personCount).toBe(pub.individuals.length);
    expect(m.familyCount).toBe(pub.families.length);
    expect(m.topSurnames[0].surname).toBe('Bryan');
    expect(m.topSurnames.every((s) => s.surname.trim() !== '')).toBe(true);
    expect(m.topSurnames.length).toBeLessThanOrEqual(30);
    expect(JSON.stringify(m)).not.toContain('"surname":""');
  });

  it('writes no empty files', () => {
    for (const [, v] of out) {
      expect(Array.isArray(v) ? v.length : Object.keys(v as object).length).toBeGreaterThan(0);
    }
  });

  it('leaks nothing sensitive', () => {
    const all = JSON.stringify([...out.values()]);
    for (const s of ['Scranton PA', '1948', 'English Village', 'Saunders', 'Palmyra', 'Advertising Copywriter']) {
      expect(all).not.toContain(s);
    }
  });
});
