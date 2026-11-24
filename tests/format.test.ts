import { buildTimeline, lifespan, yearsOf } from '../src/lib/format';
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

describe('buildTimeline', () => {
  const ev = (type: string, label: string, extra: Partial<PublicPerson['events'][number]> = {}) => ({ type, label, ...extra });
  const person = (events: PublicPerson['events']): PublicPerson => ({ ...base, events });
  const place = 'Atlantic City Ward 3, Atlantic, New Jersey, United States';

  it('collapses exact duplicate events', () => {
    const t = buildTimeline(person([ev('RESI', 'Residence', { year: 1910, place }), ev('RESI', 'Residence', { year: 1910, place }), ev('RESI', 'Residence', { year: 1910, place })]));
    expect(t).toEqual([{ year: 1910, title: `Lived in ${place}` }]);
  });

  it('sorts by year, stably, with no-year events last', () => {
    const t = buildTimeline(person([
      ev('BURI', 'Burial'), ev('DEAT', 'Death', { year: 1931, place: 'X' }),
      ev('BIRT', 'Birth', { year: 1870, place: 'New Haven CT' }), ev('EDUC', 'Education', { year: 1870 }),
    ]));
    expect(t.map((r) => r.title)).toEqual(['Born', 'Education', 'Died', 'Buried']);
    expect(t[0].detail).toBe('New Haven CT');
    expect(t[3].year).toBeUndefined();
  });

  it('extracts Occupation from a residence value', () => {
    const t = buildTimeline(person([ev('RESI', 'Residence', { year: 1915, place: 'Atlantic City NJ', value: 'Employer: Foo; Occupation: Masseur; Age: 40' })]));
    expect(t).toEqual([{ year: 1915, title: 'Lived in Atlantic City NJ', detail: 'Occupation: Masseur' }]);
  });

  it('gives no detail for a long census value without an occupation', () => {
    const value = 'Household: a, b, c, d, e; Relation: head; Marital status: married; '.repeat(5);
    const t = buildTimeline(person([ev('RESI', 'Residence', { year: 1920, value })]));
    expect(t).toEqual([{ year: 1920, title: 'Residence' }]);
    expect(JSON.stringify(t)).not.toContain('Household');
  });

  it('uses the label for other event types', () => {
    expect(buildTimeline(person([ev('OCCU', 'Occupation', { year: 1900, place: 'Here' })]))[0]).toEqual({ year: 1900, title: 'Occupation' });
  });
});
