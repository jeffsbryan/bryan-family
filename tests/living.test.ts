import { describe, expect, it } from 'vitest';
import raw from './fixtures/raw-mini.json';
import type { RawFile, RawIndividual } from '../src/shared/types';
import { LIVING_AFTER_YEAR, birthYear, isLiving } from '../src/shared/living';

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
