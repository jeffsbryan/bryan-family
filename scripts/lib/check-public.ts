import type { Overrides, PublicFile } from '../../src/shared/types';
import { LIVING_AFTER_YEAR, birthYear } from '../../src/shared/living';
import { EVENT_FIELDS, FAMILY_FIELDS, PERSON_FIELDS } from './sanitize';

const isObject = (x: unknown): x is Record<string, unknown> =>
  x !== null && typeof x === 'object' && !Array.isArray(x);

function extraFields(obj: Record<string, unknown>, allowed: readonly string[]): string[] {
  return Object.keys(obj).filter((k) => !allowed.includes(k));
}

/**
 * Structural privacy check of a sanitized file. Returns problem descriptions that name
 * person or family ids (and field names), never field values.
 */
export function checkPublicFile(pub: PublicFile, overrides: Overrides): string[] {
  const problems: string[] = [];
  const people = Array.isArray(pub?.individuals) ? pub.individuals : [];
  const families = Array.isArray(pub?.families) ? pub.families : [];
  const livingIds = new Set<string>();
  for (const p of people) if (isObject(p) && p.living === true) livingIds.add(String(p.id));

  const checkEvent = (owner: string, e: unknown): void => {
    if (!isObject(e)) {
      problems.push(`${owner}: event is not an object`);
      return;
    }
    for (const k of extraFields(e, EVENT_FIELDS)) problems.push(`${owner}: event has unexpected field "${k}"`);
  };

  for (const p of people) {
    if (!isObject(p)) {
      problems.push('an individual record is not an object');
      continue;
    }
    const id = String(p.id);
    for (const k of extraFields(p, PERSON_FIELDS)) problems.push(`${id}: unexpected field "${k}"`);
    if (typeof p.living !== 'boolean') {
      problems.push(`${id}: missing boolean "living" (unsanitized data?)`);
    } else if (p.living) {
      if (Array.isArray(p.events) ? p.events.length > 0 : p.events !== undefined) {
        problems.push(`${id}: living person has events`);
      }
      if (p.occupation !== undefined) problems.push(`${id}: living person has an occupation`);
      if (p.sex !== 'U') problems.push(`${id}: living person has a sex other than "U"`);
    } else if (overrides[id] !== 'deceased' && Array.isArray(p.events)) {
      const y = birthYear(p as unknown as Parameters<typeof birthYear>[0]);
      if (y !== undefined && y > LIVING_AFTER_YEAR) {
        problems.push(`${id}: not marked living but birth year is after ${LIVING_AFTER_YEAR}`);
      }
    }
    if (Array.isArray(p.events)) for (const e of p.events) checkEvent(id, e);
  }

  for (const f of families) {
    if (!isObject(f)) {
      problems.push('a family record is not an object');
      continue;
    }
    const id = String(f.id);
    for (const k of extraFields(f, FAMILY_FIELDS)) problems.push(`${id}: unexpected field "${k}"`);
    const spouseLiving = [f.husband, f.wife].some((s) => typeof s === 'string' && livingIds.has(s));
    if (spouseLiving && (f.marriage !== undefined || f.divorce !== undefined)) {
      problems.push(`${id}: family with a living spouse has marriage or divorce`);
    }
    for (const key of ['marriage', 'divorce'] as const) if (f[key] !== undefined) checkEvent(id, f[key]);
  }
  return problems;
}
