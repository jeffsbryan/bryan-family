import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Overrides, RawEvent, RawFile, RawIndividual } from '../../src/shared/types';
import { isLiving } from '../../src/shared/living';

function eventStrings(e: RawEvent | undefined): string[] {
  return e ? [e.place, e.date, e.value].filter((s): s is string => typeof s === 'string') : [];
}

function personStrings(i: RawIndividual): string[] {
  const out = i.events.flatMap(eventStrings);
  if (i.occupation) out.push(i.occupation);
  return out;
}

const clean = (xs: string[]) => xs.map((s) => s.trim()).filter((s) => s.length > 0);

/** Strings that appear only in data belonging to living people and must never be published. */
export function collectSensitiveStrings(raw: RawFile, overrides: Overrides): string[] {
  const living = new Map<string, boolean>();
  for (const i of raw.individuals) living.set(i.id, isLiving(i, overrides));

  const sensitive: string[] = [];
  const safe = new Set<string>();

  for (const i of raw.individuals) {
    const strings = clean(personStrings(i));
    if (living.get(i.id)) sensitive.push(...strings);
    else strings.forEach((s) => safe.add(s));
  }
  for (const f of raw.families) {
    const strings = clean([...eventStrings(f.marriage), ...eventStrings(f.divorce)]);
    const hasLiving = [f.husband, f.wife].some((id) => id !== undefined && living.get(id) === true);
    if (hasLiving) sensitive.push(...strings);
    else strings.forEach((s) => safe.add(s));
  }
  return [...new Set(sensitive)].filter((s) => !safe.has(s));
}

function walk(dir: string, out: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) walk(full, out);
    else if (e.isFile()) out.push(full);
  }
}

export function listFiles(dirs: string[]): string[] {
  const files: string[] = [];
  for (const d of dirs) {
    try {
      if (!lstatSync(d).isDirectory()) continue;
    } catch {
      continue;
    }
    walk(d, files);
  }
  return files;
}

export function findLeaks(sensitive: string[], dirs: string[]): { file: string; match: string }[] {
  const leaks: { file: string; match: string }[] = [];
  for (const file of listFiles(dirs)) {
    const text = readFileSync(file, 'utf8');
    for (const match of sensitive) {
      if (text.includes(match)) leaks.push({ file, match });
    }
  }
  return leaks;
}
