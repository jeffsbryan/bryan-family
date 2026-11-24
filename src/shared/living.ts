import type { Overrides, RawIndividual } from './types';

/** A person is treated as living if their recorded birth year is strictly after this. */
export const LIVING_AFTER_YEAR = 1940;

/** BIRT year, else the earliest BAPM/CHR year. */
export function birthYear(ind: RawIndividual): number | undefined {
  const birt = ind.events.find((e) => e.type === 'BIRT' && typeof e.year === 'number');
  if (birt) return birt.year;
  const years = ind.events
    .filter((e) => (e.type === 'BAPM' || e.type === 'CHR') && typeof e.year === 'number')
    .map((e) => e.year as number);
  return years.length ? Math.min(...years) : undefined;
}

export function isLiving(
  ind: RawIndividual,
  overrides: Overrides = {},
  cutoff: number = LIVING_AFTER_YEAR,
): boolean {
  const o = overrides[ind.id];
  if (o) return o === 'living';
  const y = birthYear(ind);
  return y !== undefined && y > cutoff;
}
