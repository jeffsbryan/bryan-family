import { describe, expect, it } from 'vitest';
import raw from './fixtures/raw-mini.json';
import type { RawFile } from '../src/shared/types';
import { sanitize } from '../scripts/lib/sanitize';

const rawFile = raw as RawFile;
const clone = (): RawFile => JSON.parse(JSON.stringify(rawFile));
const { file, report } = sanitize(rawFile, {});
const person = (id: string) => file.individuals.find((i) => i.id === id)!;
const fam = (id: string) => file.families.find((f) => f.id === id)!;

describe('sanitize', () => {
  it('strips living people to the minimal shape', () => {
    for (const id of ['I1', 'I11', 'I12', 'I14']) {
      const p = person(id);
      const r = rawFile.individuals.find((i) => i.id === id)!;
      expect(p.events).toEqual([]);
      expect(p.sex).toBe('U');
      expect(p.living).toBe(true);
      expect('occupation' in p).toBe(false);
      expect(p.id).toBe(r.id);
      expect(p.name).toBe(r.name);
      expect(p.givenName).toBe(r.givenName);
      expect(p.surname).toBe(r.surname);
      expect(p.childOfFamilies).toEqual(r.childOfFamilies);
      expect(p.spouseOfFamilies).toEqual(r.spouseOfFamilies);
    }
  });

  it('removes marriage/divorce when both spouses living; keeps for deceased', () => {
    expect('marriage' in fam('F3')).toBe(false);
    expect('divorce' in fam('F3')).toBe(false);
    expect(fam('F1')).toEqual(rawFile.families.find((f) => f.id === 'F1'));
  });

  it('removes marriage/divorce when only one spouse is living', () => {
    const r = clone();
    const f = r.families.find((x) => x.id === 'F6')!;
    f.wife = 'I11'; // living
    f.marriage = { type: 'MARR', label: 'Married', year: 1930, place: 'Somewhere' };
    f.divorce = { type: 'DIV', label: 'Divorced', year: 1935 };
    const out = sanitize(r, {}).file.families.find((x) => x.id === 'F6')!;
    expect('marriage' in out).toBe(false);
    expect('divorce' in out).toBe(false);
    expect(out.husband).toBe('I6');
    expect(out.wife).toBe('I11');
  });

  it('leaks none of the living strings', () => {
    const s = JSON.stringify(file);
    for (const bad of ['Scranton PA', '1948', 'English Village', 'Saunders', 'Palmyra', 'Advertising Copywriter']) {
      expect(s).not.toContain(bad);
    }
  });

  it('leaves deceased people unchanged apart from living:false', () => {
    for (const r of rawFile.individuals) {
      if (['I1', 'I11', 'I12', 'I14'].includes(r.id)) continue;
      expect(person(r.id)).toEqual({ ...r, living: false });
    }
  });

  it('reports counts', () => {
    expect(report.living).toBe(4);
    expect(report.livingWithDeathRecord).toBe(1);
    expect(report.bornAfter1925UpTo1940NoDeath).toEqual([
      { id: 'I9', name: 'Edwin Bryan' },
      { id: 'I10', name: 'Ray Bryan' },
    ]);
    expect(report.overridesApplied).toBe(0);
  });

  it('uses an explicit whitelist (unknown fields never leak)', () => {
    const r = clone() as any;
    r.individuals[0].secretNote = 'LEAK1'; // living
    r.individuals[1].secretNote = 'LEAK2'; // deceased
    r.individuals[1].events[0].secretNote = 'LEAK3';
    r.families[0].secretNote = 'LEAK4';
    r.families[0].marriage.secretNote = 'LEAK5';
    r.secretTop = 'LEAK6';
    const s = JSON.stringify(sanitize(r, {}).file);
    expect(s).not.toContain('LEAK');
  });

  it('applies overrides and counts only ids that exist', () => {
    const out = sanitize(rawFile, { I2: 'living', I1: 'deceased', NOPE: 'living' });
    expect(out.report.overridesApplied).toBe(2);
    expect(out.file.individuals.find((i) => i.id === 'I2')!.events).toEqual([]);
    expect(out.file.individuals.find((i) => i.id === 'I1')!.living).toBe(false);
  });
});
