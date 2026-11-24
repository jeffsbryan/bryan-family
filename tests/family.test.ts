import { beforeEach, describe, expect, it, vi } from 'vitest';
import raw from './fixtures/raw-mini.json';
import type { PublicFamily, PublicFile, PublicPerson, RawFile } from '../src/shared/types';
import { sanitize } from '../scripts/lib/sanitize';

const graph = vi.hoisted(() => ({
  people: new Map<string, unknown>(),
  families: new Map<string, unknown>(),
}));

vi.mock('../src/data/api', () => ({
  getPerson: async (id: string) => graph.people.get(id),
  getFamily: async (id: string) => graph.families.get(id),
}));

import { getFamilyView, getTreeView } from '../src/data/family';

function load(file: PublicFile) {
  graph.people = new Map(file.individuals.map((p) => [p.id, p]));
  graph.families = new Map(file.families.map((f) => [f.id, f]));
}

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe('family view and tree (fixture)', () => {
  beforeEach(() => load(sanitize(raw as RawFile, {}).file));

  it('I9 has main parents F2 and other parent families [F6]', async () => {
    const v = await getFamilyView('I9');
    expect(v?.mainParents?.familyId).toBe('F2');
    expect(v?.mainParents?.father?.id).toBe('I4');
    expect(v?.mainParents?.mother?.id).toBe('I5');
    expect(v?.otherParentFamilies.map((f) => f.familyId)).toEqual(['F6']);
  });

  it('I12 has father I13 and no mother', async () => {
    const v = await getFamilyView('I12');
    expect(v?.mainParents?.familyId).toBe('F5');
    expect(v?.mainParents?.father?.id).toBe('I13');
    expect(v?.mainParents?.mother).toBeUndefined();
  });

  it('I8 with no families gives empty results', async () => {
    const v = await getFamilyView('I8');
    expect(v?.mainParents).toBeNull();
    expect(v?.spouseFamilies).toEqual([]);
    expect(v?.siblings).toEqual([]);
    expect(v?.otherParentFamilies).toEqual([]);
  });

  it('I2 siblings are [I9]', async () => {
    const v = await getFamilyView('I2');
    expect(ids(v!.siblings)).toEqual(['I9']);
  });

  it('keeps marriage for deceased spouses and drops it for living', async () => {
    const v2 = await getFamilyView('I2');
    expect(v2?.spouseFamilies[0].familyId).toBe('F1');
    expect(v2?.spouseFamilies[0].spouse?.id).toBe('I3');
    expect(v2?.spouseFamilies[0].marriage).toBeDefined();
    expect(ids(v2!.spouseFamilies[0].children)).toEqual(['I1']);
    const v1 = await getFamilyView('I1');
    expect(v1?.spouseFamilies[0].familyId).toBe('F3');
    expect(v1?.spouseFamilies[0].spouse?.id).toBe('I14');
    expect(v1?.spouseFamilies[0].marriage).toBeUndefined();
  });

  it('getFamilyView of unknown id is undefined', async () => {
    expect(await getFamilyView('NOPE')).toBeUndefined();
  });

  it('getTreeView(I2) has two generations of ancestors', async () => {
    const t = await getTreeView('I2');
    expect(t?.root.person.id).toBe('I2');
    expect(ids(t!.root.parents.map((n) => n.person))).toEqual(['I4', 'I5']);
    const [i4, i5] = t!.root.parents;
    expect(ids(i4.parents.map((n) => n.person))).toEqual(['I6', 'I7']);
    expect(i4.parents.every((n) => !n.hasMoreAncestors)).toBe(true);
    expect(i5.hasMoreAncestors).toBe(false);
    expect(ids(t!.spouses)).toEqual(['I3']);
    expect(ids(t!.children)).toEqual(['I1']);
  });

  it('getTreeView(I2, 1) flags more ancestors', async () => {
    const t = await getTreeView('I2', 1);
    const [i4, i5] = t!.root.parents;
    expect(i4.person.id).toBe('I4');
    expect(i4.parents).toEqual([]);
    expect(i4.hasMoreAncestors).toBe(true);
    expect(i5.person.id).toBe('I5');
    expect(i5.hasMoreAncestors).toBe(false);
  });

  it('lists a spouse once when the couple appears in two families (I6 in F4 and F6)', async () => {
    const t = await getTreeView('I6');
    expect(ids(t!.spouses)).toEqual(['I7']);
    expect(ids(t!.children)).toEqual(['I4', 'I9']);
    const v = await getFamilyView('I6');
    expect(v?.spouseFamilies.map((f) => f.familyId)).toEqual(['F4', 'F6']);
  });

  it('lists a child once when two spouse families of one person both name them', async () => {
    const dup = sanitize(raw as RawFile, {}).file;
    dup.families.find((f) => f.id === 'F6')!.children.push('I4', 'I4');
    load(dup);
    const t = await getTreeView('I6');
    expect(ids(t!.children)).toEqual(['I4', 'I9']);
    const v = await getFamilyView('I6');
    expect(ids(v!.spouseFamilies[1].children)).toEqual(['I9', 'I4']);
  });

  it('getTreeView of unknown id is undefined', async () => {
    expect(await getTreeView('NOPE')).toBeUndefined();
  });
});

describe('cycle safety (hand-built graph)', () => {
  it('terminates when a person is their own parent', async () => {
    const person = (id: string, childOf: string[], spouseOf: string[]): PublicPerson => ({
      id, name: id, givenName: id, surname: 'X', sex: 'M', events: [],
      childOfFamilies: childOf, spouseOfFamilies: spouseOf, living: false,
    });
    const fam: PublicFamily = { id: 'F', husband: 'A', children: ['A'] };
    load({ format: 't', individuals: [person('A', ['F'], ['F'])], families: [fam] });
    const t = await getTreeView('A', 5);
    expect(t?.root.person.id).toBe('A');
    expect(t?.root.parents).toEqual([]);
    expect(t?.root.hasMoreAncestors).toBe(false);
    const v = await getFamilyView('A');
    expect(v?.mainParents?.father?.id).toBe('A');
  });
});
