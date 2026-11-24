import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Overrides, RawEvent, RawFile, RawIndividual } from '../../src/shared/types';
import { normalizePlace } from '../../src/shared/places';
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

/** The string plus the forms it can take in published output (normalized place, NFC, JSON-escaped). */
function expand(s: string): string[] {
  const bases = new Set<string>();
  for (const x of [s, normalizePlace(s)]) {
    bases.add(x);
    bases.add(x.normalize('NFC'));
  }
  const out = new Set<string>();
  for (const b of bases) {
    out.add(b);
    out.add(JSON.stringify(b).slice(1, -1));
  }
  return [...out].filter((x) => x.length > 0);
}

/**
 * Strings that belong to living people and must never be published, plus how many were
 * skipped because a non-living person or a family with no living spouse shares them.
 */
export function collectSensitive(
  raw: RawFile,
  overrides: Overrides,
): { strings: string[]; excludedCount: number } {
  const living = new Map<string, boolean>();
  for (const i of raw.individuals) living.set(i.id, isLiving(i, overrides));

  const sensitive = new Set<string>();
  const safe = new Set<string>();
  const add = (target: Set<string>, strings: string[]) =>
    clean(strings).forEach((s) => expand(s).forEach((x) => target.add(x)));

  for (const i of raw.individuals) add(living.get(i.id) ? sensitive : safe, personStrings(i));
  for (const f of raw.families) {
    const strings = [...eventStrings(f.marriage), ...eventStrings(f.divorce)];
    const hasLiving = [f.husband, f.wife].some((id) => id !== undefined && living.get(id) === true);
    add(hasLiving ? sensitive : safe, strings);
  }
  const strings = [...sensitive].filter((s) => !safe.has(s));
  return { strings, excludedCount: sensitive.size - strings.length };
}

export function collectSensitiveStrings(raw: RawFile, overrides: Overrides): string[] {
  return collectSensitive(raw, overrides).strings;
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
