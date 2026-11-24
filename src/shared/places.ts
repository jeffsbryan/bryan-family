import type { RawEvent } from './types';

/** Trim, drop one trailing ", United States" / ", USA", collapse repeated spaces. */
export function normalizePlace(place: string): string {
  return place
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/, (?:United States|USA)$/, '')
    .trim();
}

/** Normalize places and drop exact duplicates (first kept, order preserved). Does not mutate input. */
export function cleanEvents(events: RawEvent[]): RawEvent[] {
  const seen = new Set<string>();
  const out: RawEvent[] = [];
  for (const e of events) {
    const copy: RawEvent = { ...e };
    if (e.place !== undefined) copy.place = normalizePlace(e.place);
    const key = JSON.stringify([copy.type, copy.year ?? null, copy.date ?? null, copy.place ?? null, copy.value ?? null]);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(copy);
  }
  return out;
}
