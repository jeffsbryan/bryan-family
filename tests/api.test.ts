import { beforeEach, describe, expect, it, vi } from 'vitest';
import raw from './fixtures/raw-mini.json';
import type { PublicPerson, RawFile, SearchEntry } from '../src/shared/types';
import { sanitize } from '../scripts/lib/sanitize';
import { buildData } from '../scripts/lib/build-data';

const served = buildData(sanitize(raw as RawFile, {}).file, new Date('2026-01-02T03:04:05.000Z'));
const base = import.meta.env.BASE_URL + 'data/';

let fetchMock: ReturnType<typeof vi.fn>;
let api: typeof import('../src/data/api');

function stub(overrides: Record<string, () => Response | Promise<Response>> = {}) {
  fetchMock = vi.fn(async (url: string) => {
    const path = String(url).slice(base.length);
    if (overrides[path]) return overrides[path]();
    const body = served.get(path);
    if (body === undefined) return new Response('nope', { status: 404 });
    return new Response(JSON.stringify(body), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
}

beforeEach(async () => {
  vi.resetModules();
  stub();
  api = await import('../src/data/api');
});

const paths = () => fetchMock.mock.calls.map((c) => String(c[0]).slice(base.length));
const e = (id: string, name: string): SearchEntry => [id, name, null, null];

describe('getPerson / getFamily / getManifest', () => {
  it('fetches the bucket once for repeated calls', async () => {
    const a = await api.getPerson('I4');
    const b = await api.getPerson('I4');
    expect(a?.id).toBe('I4');
    expect(b).toBe(a);
    expect(paths()).toEqual(['people/4.json']);
  });

  it('returns undefined for unknown ids and 404 buckets', async () => {
    expect(await api.getPerson('I4')).toBeDefined();
    expect(await api.getPerson('I204')).toBeUndefined();
    expect(await api.getPerson('I199')).toBeUndefined();
    expect(await api.getFamily('F4')).toBeDefined();
    expect(await api.getFamily('F198')).toBeUndefined();
  });

  it('loads the manifest', async () => {
    expect((await api.getManifest()).bucketCount).toBe(200);
  });

  it('does not cache failures forever', async () => {
    let n = 0;
    stub({
      'people/4.json': () => (n++ === 0 ? new Response('x', { status: 500 }) : new Response(JSON.stringify({ I4: { id: 'I4' } as PublicPerson }))),
    });
    await expect(api.getPerson('I4')).rejects.toThrow(/people\/4\.json/);
    expect((await api.getPerson('I4'))?.id).toBe('I4');
  });

  it('rejects on network errors and retries', async () => {
    let n = 0;
    stub({
      'manifest.json': () => {
        if (n++ === 0) throw new TypeError('offline');
        return new Response(JSON.stringify({ bucketCount: 200 }));
      },
    });
    await expect(api.getManifest()).rejects.toThrow(/manifest\.json/);
    expect((await api.getManifest()).bucketCount).toBe(200);
  });
});

describe('matchEntries', () => {
  const list = [e('I1', "Pat O'Brien"), e('I2', 'Brian Obrien Smith'), e('I3', 'Oliver Bryan'), e('I4', 'Ana Brien'), e('I5', 'José Müller')];

  it('is case-insensitive and prefix-based on every token', () => {
    expect(api.matchEntries(list, 'OLIV bry').map((x) => x[0])).toEqual(['I3']);
    expect(api.matchEntries(list, 'oliver zzz')).toEqual([]);
  });

  it('ignores accents and apostrophes', () => {
    expect(api.matchEntries(list, 'obrien').map((x) => x[0])).toContain('I1');
    expect(api.matchEntries(list, "o'brien").map((x) => x[0])).toContain('I1');
    expect(api.matchEntries(list, 'o’brien').map((x) => x[0])).toContain('I1');
    expect(api.matchEntries(list, 'jose muller').map((x) => x[0])).toEqual(['I5']);
  });

  it('ranks exact surname first and does not mutate', () => {
    const copy = [...list];
    const r = api.matchEntries([e('I9', 'Bryant Zed'), e('I8', 'Al Bryan')], 'bryan');
    expect(r.map((x) => x[0])).toEqual(['I8', 'I9']);
    api.matchEntries(list, 'brien');
    expect(list).toEqual(copy);
  });
});

describe('searchPeople', () => {
  it('returns [] without fetching for short queries', async () => {
    expect(await api.searchPeople('')).toEqual([]);
    expect(await api.searchPeople('b')).toEqual([]);
    expect(await api.searchPeople("'")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loads only the matching shard', async () => {
    const r = await api.searchPeople('hay');
    expect(r.some((x) => x[0] === 'I2')).toBe(true);
    expect(paths()).toEqual(['search/ha.json']);
  });

  it('finds the blank-surname person by given name', async () => {
    expect((await api.searchPeople('Mary')).map((x) => x[0])).toContain('I8');
  });

  it('returns living entries with null years and honours limit', async () => {
    const r = await api.searchPeople('bryan');
    const living = r.find((x) => x[0] === 'I1');
    expect(living).toEqual(['I1', 'Stephen Thomas Bryan', null, null]);
    expect(await api.searchPeople('bryan', 1)).toHaveLength(1);
  });

  it('treats a missing shard as empty', async () => {
    expect(await api.searchPeople('zzzz')).toEqual([]);
  });
});
