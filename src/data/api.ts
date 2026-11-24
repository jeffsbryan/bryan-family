import { BUCKET_COUNT, bucketOf, shardKey } from '../shared/keys';
import type { Manifest, PublicFamily, PublicPerson, SearchEntry } from '../shared/types';

const cache = new Map<string, Promise<unknown>>();

function url(path: string): string {
  return import.meta.env.BASE_URL + 'data/' + path;
}

/** Fetch JSON with a per-URL promise cache. 404 resolves to `notFound`; other failures reject and are not cached. */
function load<T, N>(path: string, notFound: N): Promise<T | N> {
  const u = url(path);
  const hit = cache.get(u);
  if (hit) return hit as Promise<T | N>;
  const p = (async () => {
    let res: Response;
    try {
      res = await fetch(u);
    } catch (err) {
      throw new Error(`Failed to fetch ${u}: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (res.status === 404) return notFound;
    if (!res.ok) throw new Error(`Failed to fetch ${u}: HTTP ${res.status}`);
    // A host that rewrites unknown paths to index.html answers 200 with HTML: treat it as a 404.
    if (res.headers.get('content-type')?.includes('text/html')) return notFound;
    try {
      return (await res.json()) as T;
    } catch {
      throw new Error(`Invalid JSON from ${u}`);
    }
  })();
  cache.set(u, p);
  p.catch(() => {
    if (cache.get(u) === p) cache.delete(u);
  });
  return p;
}

export async function getManifest(): Promise<Manifest> {
  const m = await load<Manifest, undefined>('manifest.json', undefined);
  if (!m) throw new Error(`Missing ${url('manifest.json')}`);
  return m;
}

export async function getPerson(id: string): Promise<PublicPerson | undefined> {
  const bucket = await load<Record<string, PublicPerson>, undefined>(`people/${bucketOf(id, BUCKET_COUNT)}.json`, undefined);
  return bucket && Object.hasOwn(bucket, id) ? bucket[id] : undefined;
}

export async function getFamily(id: string): Promise<PublicFamily | undefined> {
  const bucket = await load<Record<string, PublicFamily>, undefined>(`families/${bucketOf(id, BUCKET_COUNT)}.json`, undefined);
  return bucket && Object.hasOwn(bucket, id) ? bucket[id] : undefined;
}

export async function loadShard(key: string): Promise<SearchEntry[]> {
  return load<SearchEntry[], SearchEntry[]>(`search/${key}.json`, []);
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function matchEntries(entries: SearchEntry[], query: string): SearchEntry[] {
  const q = tokenize(query);
  if (q.length === 0) return [];
  const last = q[q.length - 1];
  const exact: SearchEntry[] = [];
  const rest: SearchEntry[] = [];
  for (const entry of entries) {
    const nameTokens = tokenize(entry[1]);
    if (!q.every((t) => nameTokens.some((n) => n.startsWith(t)))) continue;
    (nameTokens[nameTokens.length - 1] === last ? exact : rest).push(entry);
  }
  const cmp = (a: SearchEntry, b: SearchEntry) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]);
  return [...exact.sort(cmp), ...rest.sort(cmp)];
}

export async function searchPeople(query: string, limit = 25): Promise<SearchEntry[]> {
  const tokens = tokenize(query);
  if (tokens.length === 0 || tokens[0].length < 2) return [];
  const key = shardKey(tokens[0]);
  const { shardKeys } = await getManifest();
  if (Array.isArray(shardKeys) && !shardKeys.includes(key)) return [];
  const shard = await loadShard(key);
  return matchEntries(shard, query).slice(0, limit);
}
