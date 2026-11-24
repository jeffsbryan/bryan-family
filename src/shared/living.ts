import type { Overrides, RawEvent, RawIndividual } from './types';

/** A person is treated as living if their recorded birth year is strictly after this. */
export const LIVING_AFTER_YEAR = 1940;

const YEAR_IN_DATE = /(?<![0-9])(1[5-9][0-9]{2}|20[0-9]{2})(?![0-9])/;

/** First standalone four-digit year 1500..2099 in a free-text date ("Abt 1950"), else undefined. */
export function yearFromDate(date: string | undefined): number | undefined {
  const m = date === undefined ? null : YEAR_IN_DATE.exec(date);
  return m ? Number(m[1]) : undefined;
}

/** The numeric year of an event, else the year parsed from its date text. */
function eventYear(e: RawEvent): number | undefined {
  return typeof e.year === 'number' ? e.year : yearFromDate(e.date);
}

function birtYears(ind: RawIndividual): number[] {
  return ind.events
    .filter((e) => e.type === 'BIRT')
    .map(eventYear)
    .filter((y): y is number => y !== undefined);
}

function baptismYears(ind: RawIndividual): number[] {
  return ind.events
    .filter((e) => (e.type === 'BAPM' || e.type === 'CHR') && typeof e.year === 'number')
    .map((e) => e.year as number);
}

/** For display: the earliest BIRT year (date text as fallback), else the earliest BAPM/CHR year. */
export function birthYear(ind: RawIndividual): number | undefined {
  const birt = birtYears(ind);
  if (birt.length) return Math.min(...birt);
  const bap = baptismYears(ind);
  return bap.length ? Math.min(...bap) : undefined;
}

/** For the living rule: the latest BIRT year (date text as fallback), else the latest BAPM/CHR year. */
export function latestBirthYear(ind: RawIndividual): number | undefined {
  const birt = birtYears(ind);
  if (birt.length) return Math.max(...birt);
  const bap = baptismYears(ind);
  return bap.length ? Math.max(...bap) : undefined;
}

export function isLiving(
  ind: RawIndividual,
  overrides: Overrides = {},
  cutoff: number = LIVING_AFTER_YEAR,
): boolean {
  const o = overrides[ind.id];
  if (o) return o === 'living';
  const y = latestBirthYear(ind);
  return y !== undefined && y > cutoff;
}
