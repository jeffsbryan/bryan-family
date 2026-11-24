import { describe, expect, it } from 'vitest';
import raw from './fixtures/raw-mini.json';
import type { RawFile, RawIndividual } from '../src/shared/types';
import { LIVING_AFTER_YEAR, birthYear, isLiving, latestBirthYear } from '../src/shared/living';

const file = raw as RawFile;
const p = (id: string): RawIndividual => file.individuals.find((i) => i.id === id)!;

describe('living rule', () => {
  it('cutoff constant is 1940', () => {
    expect(LIVING_AFTER_YEAR).toBe(1940);
  });
  it('1940 birth is not living', () => expect(isLiving(p('I10'))).toBe(false));
  it('1941 birth is living even if deceased', () => expect(isLiving(p('I11'))).toBe(true));
  it('falls back to CHR year', () => {
    expect(birthYear(p('I12'))).toBe(1955);
    expect(isLiving(p('I12'))).toBe(true);
  });
  it('1938 birth with no death is not living', () => expect(isLiving(p('I9'))).toBe(false));
  it('no events is not living', () => {
    expect(birthYear(p('I8'))).toBeUndefined();
    expect(isLiving(p('I8'))).toBe(false);
  });
  it('BIRT year wins', () => expect(birthYear(p('I1'))).toBe(1948));
  it('overrides win', () => {
    expect(isLiving(p('I1'), { I1: 'deceased' })).toBe(false);
    expect(isLiving(p('I9'), { I9: 'living' })).toBe(true);
  });
  it('custom cutoff', () => expect(isLiving(p('I10'), {}, 1930)).toBe(true));
});

describe('living rule robustness to FTM birth data', () => {
  const person = (events: RawIndividual['events']): RawIndividual => ({
    id: 'X1', name: 'Test Person', givenName: 'Test', surname: 'Person', sex: 'M',
    events, childOfFamilies: [], spouseOfFamilies: [],
  });
  const birt = (o: { year?: number; date?: string }) => ({ type: 'BIRT', label: 'Born', ...o });

  it('two BIRT events 1938 and 1945 means living, display year is the earliest', () => {
    const x = person([birt({ year: 1938 }), birt({ year: 1945 })]);
    expect(isLiving(x)).toBe(true);
    expect(birthYear(x)).toBe(1938);
    expect(latestBirthYear(x)).toBe(1945);
  });
  it('date-only "Abt 1950" with no year means living', () => {
    const x = person([birt({ date: 'Abt 1950' })]);
    expect(birthYear(x)).toBe(1950);
    expect(isLiving(x)).toBe(true);
  });
  it('date "5 BC" yields no year and is not living', () => {
    const x = person([birt({ date: '5 BC' })]);
    expect(birthYear(x)).toBeUndefined();
    expect(isLiving(x)).toBe(false);
  });
  it('a numeric year wins over the date text', () => {
    expect(birthYear(person([birt({ year: 1900, date: '1 JAN 1999' })]))).toBe(1900);
  });
  it('ignores digits that are part of a longer number', () => {
    expect(birthYear(person([birt({ date: '119501' })]))).toBeUndefined();
  });
  it('BAPM/CHR fallback only when no BIRT year at all', () => {
    const x = person([{ type: 'CHR', label: 'Christened', year: 1955 }, birt({ date: 'unknown' })]);
    expect(birthYear(x)).toBe(1955);
    expect(isLiving(x)).toBe(true);
  });
});
