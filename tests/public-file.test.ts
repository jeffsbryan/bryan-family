import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import raw from './fixtures/raw-mini.json';
import type { Overrides, PublicFile, RawFile } from '../src/shared/types';
import { sanitize } from '../scripts/lib/sanitize';
import { checkPublicFile } from '../scripts/lib/check-public';

const rawFile = raw as RawFile;
const clean = (): PublicFile => JSON.parse(JSON.stringify(sanitize(rawFile, {}).file));
const none: Overrides = {};

describe('checkPublicFile', () => {
  it('accepts sanitized fixture output', () => {
    expect(checkPublicFile(sanitize(rawFile, {}).file, none)).toEqual([]);
  });

  it('rejects the raw fixture', () => {
    const problems = checkPublicFile(raw as unknown as PublicFile, none);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.some((p) => p.startsWith('I1:'))).toBe(true);
  });

  it('names a living person whose events were restored, without the place text', () => {
    const f = clean();
    const living = f.individuals.find((i) => i.id === 'I1')!;
    living.events = rawFile.individuals.find((i) => i.id === 'I1')!.events;
    const problems = checkPublicFile(f, none);
    expect(problems.some((p) => p.includes('I1'))).toBe(true);
    expect(problems.join('\n')).not.toContain('Scranton');
    expect(problems.join('\n')).not.toContain('English Village');
  });

  it('flags living occupation and non-U sex', () => {
    const f = clean();
    const living = f.individuals.find((i) => i.id === 'I1')!;
    living.occupation = 'Secret Job';
    living.sex = 'M';
    const text = checkPublicFile(f, none).join('\n');
    expect(text).toContain('I1: living person has an occupation');
    expect(text).toContain('I1: living person has a sex');
    expect(text).not.toContain('Secret Job');
  });

  it('flags marriage on a family with a living spouse', () => {
    const f = clean();
    const fam = f.families.find((x) => x.id === 'F3')!;
    fam.marriage = { type: 'MARR', label: 'Married', year: 1970, place: 'Hidden Chapel' };
    const problems = checkPublicFile(f, none);
    expect(problems).toEqual(['F3: family with a living spouse has marriage or divorce']);
  });

  it('flags a non-living person born after the cutoff unless overridden deceased', () => {
    const f = clean();
    const p = f.individuals.find((i) => i.id === 'I11')!;
    p.living = false;
    p.events = rawFile.individuals.find((i) => i.id === 'I11')!.events;
    expect(checkPublicFile(f, none).some((x) => x.startsWith('I11:'))).toBe(true);
    expect(checkPublicFile(f, { I11: 'deceased' })).toEqual([]);
  });

  it('flags a person lacking a boolean living field', () => {
    const f = clean();
    delete (f.individuals[0] as { living?: boolean }).living;
    expect(checkPublicFile(f, none).some((x) => x.includes(`${f.individuals[0].id}:`))).toBe(true);
  });

  it('flags fields outside the whitelist on people, families and events', () => {
    const f = clean();
    (f.individuals[1] as unknown as Record<string, unknown>).notes = 'x';
    (f.families[0] as unknown as Record<string, unknown>).secret = 'x';
    const dead = f.individuals.find((i) => !i.living && i.events.length > 0)!;
    (dead.events[0] as unknown as Record<string, unknown>).source = 'x';
    const text = checkPublicFile(f, none).join('\n');
    expect(text).toContain('unexpected field "notes"');
    expect(text).toContain('unexpected field "secret"');
    expect(text).toContain('unexpected field "source"');
  });

  const publicPath = join(import.meta.dirname, '..', 'data', 'family.public.json');
  it.skipIf(!existsSync(publicPath))('data/family.public.json passes the check', () => {
    const pub = JSON.parse(readFileSync(publicPath, 'utf8')) as PublicFile;
    const overridesPath = join(import.meta.dirname, '..', 'data', 'overrides.json');
    const overrides = existsSync(overridesPath) ? (JSON.parse(readFileSync(overridesPath, 'utf8')) as Overrides) : {};
    expect(checkPublicFile(pub, overrides)).toEqual([]);
  });
});
