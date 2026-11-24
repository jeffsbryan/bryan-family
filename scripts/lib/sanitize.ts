import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type {
  Overrides,
  PublicFamily,
  PublicFile,
  PublicPerson,
  RawEvent,
  RawFamily,
  RawFile,
  RawIndividual,
} from '../../src/shared/types';
import { LIVING_AFTER_YEAR, birthYear, isLiving } from '../../src/shared/living';

export interface SanitizeReport {
  living: number;
  livingWithDeathRecord: number;
  bornAfter1925UpTo1940NoDeath: { id: string; name: string }[];
  overridesApplied: number;
  noBirthYearRecentEvidence: { id: string; name: string }[];
}

/** Throws if any override value is not exactly 'living'/'deceased' or any id is unknown. */
export function validateOverrides(overrides: unknown, ids: Iterable<string>): Overrides {
  if (overrides === null || typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw new Error('Invalid overrides: expected a JSON object mapping id to "living" or "deceased"');
  }
  const known = new Set(ids);
  for (const [id, value] of Object.entries(overrides)) {
    if (value !== 'living' && value !== 'deceased') {
      throw new Error(
        `Invalid override for ${id}: ${JSON.stringify(value)} (must be exactly "living" or "deceased")`,
      );
    }
    if (!known.has(id)) {
      throw new Error(`Invalid override: id ${id} (value ${JSON.stringify(value)}) is not in the raw data`);
    }
  }
  return overrides as Overrides;
}

/** The only fields the sanitizer ever writes. checkPublicFile rejects anything else. */
export const EVENT_FIELDS = ['type', 'label', 'date', 'year', 'month', 'day', 'place', 'value'] as const;
export const PERSON_FIELDS = [
  'id', 'name', 'givenName', 'surname', 'sex', 'events', 'childOfFamilies', 'spouseOfFamilies', 'living', 'occupation',
] as const;
export const FAMILY_FIELDS = ['id', 'husband', 'wife', 'children', 'marriage', 'divorce'] as const;

/** Throws (naming the person id, never the value) when a BIRT, DEAT, BAPM or CHR year is present but not a finite number. */
function assertNumericYears(raw: RawFile): void {
  for (const i of raw.individuals) {
    for (const e of i.events) {
      if (e.type !== 'BIRT' && e.type !== 'DEAT' && e.type !== 'BAPM' && e.type !== 'CHR') continue;
      const y: unknown = e.year;
      if (y === undefined || y === null) continue;
      if (typeof y !== 'number' || !Number.isFinite(y)) {
        throw new Error(`Invalid ${e.type} year for ${i.id}: not a number`);
      }
    }
  }
}

// Every output object is built field by field. Never spread an input object.
function copyEvent(e: RawEvent): RawEvent {
  const out: RawEvent = { type: e.type, label: e.label };
  if (e.date !== undefined) out.date = e.date;
  if (e.year !== undefined) out.year = e.year;
  if (e.month !== undefined) out.month = e.month;
  if (e.day !== undefined) out.day = e.day;
  if (e.place !== undefined) out.place = e.place;
  if (e.value !== undefined) out.value = e.value;
  return out;
}

function livingPerson(i: RawIndividual): PublicPerson {
  return {
    id: i.id,
    name: i.name,
    givenName: i.givenName,
    surname: i.surname,
    sex: 'U',
    events: [],
    childOfFamilies: [...i.childOfFamilies],
    spouseOfFamilies: [...i.spouseOfFamilies],
    living: true,
  };
}

function deceasedPerson(i: RawIndividual): PublicPerson {
  const out: PublicPerson = {
    id: i.id,
    name: i.name,
    givenName: i.givenName,
    surname: i.surname,
    sex: i.sex,
    events: i.events.map(copyEvent),
    childOfFamilies: [...i.childOfFamilies],
    spouseOfFamilies: [...i.spouseOfFamilies],
    living: false,
  };
  if (i.occupation !== undefined) out.occupation = i.occupation;
  return out;
}

function publicFamily(f: RawFamily, livingIds: Set<string>): PublicFamily {
  const out: PublicFamily = { id: f.id, children: [...f.children] };
  if (f.husband !== undefined) out.husband = f.husband;
  if (f.wife !== undefined) out.wife = f.wife;
  const anyLiving =
    (f.husband !== undefined && livingIds.has(f.husband)) ||
    (f.wife !== undefined && livingIds.has(f.wife));
  if (!anyLiving) {
    if (f.marriage) out.marriage = copyEvent(f.marriage);
    if (f.divorce) out.divorce = copyEvent(f.divorce);
  }
  return out;
}

const hasDeathRecord = (i: RawIndividual): boolean =>
  i.events.some((e) => e.type === 'DEAT' || e.type === 'BURI');

export function sanitize(
  raw: RawFile,
  overrides: Overrides,
  cutoff: number = LIVING_AFTER_YEAR,
): { file: PublicFile; report: SanitizeReport } {
  assertNumericYears(raw);
  const livingIds = new Set<string>();
  const report: SanitizeReport = {
    living: 0,
    livingWithDeathRecord: 0,
    bornAfter1925UpTo1940NoDeath: [],
    overridesApplied: 0,
    noBirthYearRecentEvidence: [],
  };
  const recentMarriageSpouses = new Set<string>();
  for (const f of raw.families) {
    if (typeof f.marriage?.year === 'number' && f.marriage.year > cutoff) {
      if (f.husband !== undefined) recentMarriageSpouses.add(f.husband);
      if (f.wife !== undefined) recentMarriageSpouses.add(f.wife);
    }
  }

  const individuals = raw.individuals.map((i) => {
    if (Object.prototype.hasOwnProperty.call(overrides, i.id)) report.overridesApplied++;
    if (isLiving(i, overrides, cutoff)) {
      livingIds.add(i.id);
      report.living++;
      if (hasDeathRecord(i)) report.livingWithDeathRecord++;
      return livingPerson(i);
    }
    const y = birthYear(i);
    if (
      y === undefined &&
      !hasDeathRecord(i) &&
      (i.events.some((e) => typeof e.year === 'number' && e.year > cutoff) ||
        recentMarriageSpouses.has(i.id))
    ) {
      report.noBirthYearRecentEvidence.push({ id: i.id, name: i.name });
    }
    if (y !== undefined && y >= 1926 && y <= 1940 && !hasDeathRecord(i)) {
      report.bornAfter1925UpTo1940NoDeath.push({ id: i.id, name: i.name });
    }
    return deceasedPerson(i);
  });

  const families = raw.families.map((f) => publicFamily(f, livingIds));
  return { file: { format: raw.format, individuals, families }, report };
}

export function sanitizeFile(
  rawPath: string,
  outPath: string,
  overridesPath: string,
): SanitizeReport {
  const raw = JSON.parse(readFileSync(rawPath, 'utf8')) as RawFile;
  const overrides = validateOverrides(
    JSON.parse(readFileSync(overridesPath, 'utf8')),
    raw.individuals.map((i) => i.id),
  );
  const { file, report } = sanitize(raw, overrides);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(file, null, 2) + '\n');
  return report;
}
