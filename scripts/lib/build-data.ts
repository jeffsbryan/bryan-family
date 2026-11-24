import type { Manifest, PublicFile, SearchEntry } from '../../src/shared/types';
import { BUCKET_COUNT, bucketOf, shardKey } from '../../src/shared/keys';
import { cleanEvents } from '../../src/shared/places';

export function buildData(pub: PublicFile, now: Date = new Date()): Map<string, unknown> {
  const out = new Map<string, unknown>();

  const people = new Map<number, Record<string, unknown>>();
  const families = new Map<number, Record<string, unknown>>();
  const shards = new Map<string, Map<string, SearchEntry>>();
  const surnameCounts = new Map<string, number>();

  for (const p of pub.individuals) {
    const n = bucketOf(p.id, BUCKET_COUNT);
    const bucket = people.get(n) ?? {};
    bucket[p.id] = { ...p, events: cleanEvents(p.events) };
    people.set(n, bucket);

    const year = (type: string): number | null =>
      p.living ? null : (p.events.find((e) => e.type === type && typeof e.year === 'number')?.year ?? null);
    const entry: SearchEntry = [p.id, p.name, year('BIRT'), year('DEAT')];

    const first = p.givenName.trim().split(/\s+/)[0] ?? '';
    const keys = new Set<string>([p.surname.trim() ? shardKey(p.surname) : '__']);
    if (first) keys.add(shardKey(first));
    for (const k of keys) {
      const shard = shards.get(k) ?? new Map<string, SearchEntry>();
      shard.set(p.id, entry);
      shards.set(k, shard);
    }

    const s = p.surname.trim();
    if (s) surnameCounts.set(s, (surnameCounts.get(s) ?? 0) + 1);
  }

  for (const f of pub.families) {
    const n = bucketOf(f.id, BUCKET_COUNT);
    const bucket = families.get(n) ?? {};
    bucket[f.id] = f;
    families.set(n, bucket);
  }

  const topSurnames = [...surnameCounts]
    .map(([surname, count]) => ({ surname, count }))
    .sort((a, b) => b.count - a.count || (a.surname < b.surname ? -1 : a.surname > b.surname ? 1 : 0))
    .slice(0, 30);

  const manifest: Manifest = {
    generatedAt: now.toISOString(),
    personCount: pub.individuals.length,
    familyCount: pub.families.length,
    bucketCount: BUCKET_COUNT,
    topSurnames,
  };
  out.set('manifest.json', manifest);
  for (const [n, v] of people) out.set(`people/${n}.json`, v);
  for (const [n, v] of families) out.set(`families/${n}.json`, v);
  for (const [k, shard] of shards) {
    const entries = [...shard.values()].sort(
      (a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
    );
    out.set(`search/${k}.json`, entries);
  }
  return out;
}
