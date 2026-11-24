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

/** Substring scanning of non-JSON files ignores short or purely numeric/punctuation strings (too many false hits). */
export const MIN_SUBSTRING_LENGTH = 6;
const isDigitsOrPunctuation = (s: string): boolean => /^[\p{N}\p{P}\p{S}\s]*$/u.test(s);

function forEachString(value: unknown, visit: (s: string) => void): void {
  if (typeof value === 'string') visit(value);
  else if (Array.isArray(value)) for (const v of value) forEachString(v, visit);
  else if (value !== null && typeof value === 'object') for (const v of Object.values(value)) forEachString(v, visit);
}

/**
 * Parsed `.json` files are compared value by value for exact equality, so a living person's
 * "1950" does not match a deceased person's "5 MAR 1950". Other files (and `.json` files that
 * do not parse) are scanned for substrings, but only strings of 6+ characters that are not
 * purely digits and punctuation.
 */
export function findLeaks(sensitive: string[], dirs: string[]): { file: string; match: string }[] {
  const exact = new Set(sensitive);
  const substrings = sensitive.filter((s) => s.length >= MIN_SUBSTRING_LENGTH && !isDigitsOrPunctuation(s));
  const leaks: { file: string; match: string }[] = [];
  for (const file of listFiles(dirs)) {
    const text = readFileSync(file, 'utf8');
    let parsed: unknown;
    let isJson = false;
    if (file.endsWith('.json')) {
      try {
        parsed = JSON.parse(text);
        isJson = true;
      } catch {
        isJson = false;
      }
    }
    if (isJson) {
      const hits = new Set<string>();
      forEachString(parsed, (v) => {
        if (exact.has(v)) hits.add(v);
        else {
          const nfc = v.normalize('NFC');
          if (exact.has(nfc)) hits.add(nfc);
        }
      });
      for (const match of hits) leaks.push({ file, match });
    } else {
      for (const match of substrings) if (text.includes(match)) leaks.push({ file, match });
    }
  }
  return leaks;
}
