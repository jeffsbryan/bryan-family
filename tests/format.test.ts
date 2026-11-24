import { lifespan, yearsOf } from '../src/lib/format';
import type { PublicPerson } from '../src/shared/types';

const base: PublicPerson = {
  id: 'I1', name: 'Test Person', givenName: 'Test', surname: 'Person', sex: 'M',
  events: [], childOfFamilies: [], spouseOfFamilies: [], living: false,
};

describe('yearsOf', () => {
  it('reads birth and death years', () => {
    const p = { ...base, events: [
      { type: 'BIRT', label: 'Birth', year: 1870 },
      { type: 'DEAT', label: 'Death', year: 1931 },
    ] };
    expect(yearsOf(p)).toEqual({ birthYear: 1870, deathYear: 1931 });
  });
  it('falls back to baptism for birth and nulls missing death', () => {
    const p = { ...base, events: [{ type: 'CHR', label: 'Christening', year: 1800 }] };
    expect(yearsOf(p)).toEqual({ birthYear: 1800, deathYear: null });
  });
  it('gives nulls for living people', () => {
    const p = { ...base, living: true, events: [{ type: 'BIRT', label: 'Birth', year: 1980 }] };
    expect(yearsOf(p)).toEqual({ birthYear: null, deathYear: null });
  });
  it('gives nulls when no events', () => {
    expect(yearsOf(base)).toEqual({ birthYear: null, deathYear: null });
  });
});

describe('lifespan', () => {
  it('formats combinations', () => {
    expect(lifespan(1870, 1931, false)).toBe('1870 – 1931');
    expect(lifespan(1870, null, false)).toBe('1870 –');
    expect(lifespan(null, 1931, false)).toBe('– 1931');
    expect(lifespan(null, null, false)).toBe('');
    expect(lifespan(1870, 1931, true)).toBe('');
  });
});
