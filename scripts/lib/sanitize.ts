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
  const livingIds = new Set<string>();
  const report: SanitizeReport = {
    living: 0,
    livingWithDeathRecord: 0,
    bornAfter1925UpTo1940NoDeath: [],
    overridesApplied: 0,
  };

  const individuals = raw.individuals.map((i) => {
    if (Object.prototype.hasOwnProperty.call(overrides, i.id)) report.overridesApplied++;
    if (isLiving(i, overrides, cutoff)) {
      livingIds.add(i.id);
      report.living++;
      if (hasDeathRecord(i)) report.livingWithDeathRecord++;
      return livingPerson(i);
    }
    const y = birthYear(i);
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
  const overrides = JSON.parse(readFileSync(overridesPath, 'utf8')) as Overrides;
  const { file, report } = sanitize(raw, overrides);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(file, null, 2) + '\n');
  return report;
}
