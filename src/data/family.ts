import type { PublicPerson, RawEvent } from '../shared/types';
import { getFamily, getPerson } from './api';

export interface ParentFamily {
  familyId: string;
  father?: PublicPerson;
  mother?: PublicPerson;
}

export interface SpouseFamily {
  familyId: string;
  spouse?: PublicPerson;
  marriage?: RawEvent;
  children: PublicPerson[];
}

export interface FamilyView {
  person: PublicPerson;
  mainParents: ParentFamily | null;
  otherParentFamilies: ParentFamily[];
  spouseFamilies: SpouseFamily[];
  siblings: PublicPerson[];
}

export interface TreeNode {
  person: PublicPerson;
  parents: TreeNode[];
  hasMoreAncestors: boolean;
}

export interface TreeView {
  root: TreeNode;
  spouses: PublicPerson[];
  children: PublicPerson[];
}

async function people(ids: (string | undefined)[]): Promise<PublicPerson[]> {
  const found = await Promise.all(ids.map((id) => (id ? getPerson(id) : Promise.resolve(undefined))));
  return found.filter((p): p is PublicPerson => p !== undefined);
}

async function one(id: string | undefined): Promise<PublicPerson | undefined> {
  return id ? getPerson(id) : undefined;
}

async function parentFamily(familyId: string): Promise<ParentFamily | undefined> {
  const fam = await getFamily(familyId);
  if (!fam) return undefined;
  const [father, mother] = await Promise.all([one(fam.husband), one(fam.wife)]);
  return { familyId, father, mother };
}

async function spouseFamily(personId: string, familyId: string): Promise<SpouseFamily | undefined> {
  const fam = await getFamily(familyId);
  if (!fam) return undefined;
  const spouseId = fam.husband === personId ? fam.wife : fam.husband;
  const [spouse, children] = await Promise.all([one(spouseId), people(fam.children)]);
  return { familyId, spouse, marriage: fam.marriage, children };
}

async function spouseFamilies(person: PublicPerson): Promise<SpouseFamily[]> {
  const all = await Promise.all(person.spouseOfFamilies.map((f) => spouseFamily(person.id, f)));
  return all
    .filter((f): f is NonNullable<typeof f> => f !== undefined)
    .map(({ familyId, spouse, marriage, children }) => ({ familyId, spouse, marriage, children }));
}

export async function getFamilyView(id: string): Promise<FamilyView | undefined> {
  const person = await getPerson(id);
  if (!person) return undefined;
  const [mainId, ...otherIds] = person.childOfFamilies;

  const [mainParents, others, spouseFams, siblings] = await Promise.all([
    mainId ? parentFamily(mainId) : Promise.resolve(undefined),
    Promise.all(otherIds.map(parentFamily)),
    spouseFamilies(person),
    mainId
      ? getFamily(mainId).then((f) => (f ? people(f.children.filter((c) => c !== id)) : []))
      : Promise.resolve([] as PublicPerson[]),
  ]);

  return {
    person,
    mainParents: mainParents ?? null,
    otherParentFamilies: others.filter((f): f is ParentFamily => f !== undefined),
    spouseFamilies: spouseFams,
    siblings,
  };
}

async function mainParentsOf(person: PublicPerson, path: Set<string>): Promise<PublicPerson[]> {
  const famId = person.childOfFamilies[0];
  if (!famId) return [];
  const pf = await parentFamily(famId);
  if (!pf) return [];
  return [pf.father, pf.mother].filter((p): p is PublicPerson => p !== undefined && !path.has(p.id));
}

async function buildNode(person: PublicPerson, depth: number, up: number, path: Set<string>): Promise<TreeNode> {
  const nextPath = new Set(path).add(person.id);
  const parents = await mainParentsOf(person, nextPath);
  if (depth >= up) {
    return { person, parents: [], hasMoreAncestors: parents.length > 0 };
  }
  const nodes = await Promise.all(parents.map((p) => buildNode(p, depth + 1, up, nextPath)));
  return { person, parents: nodes, hasMoreAncestors: false };
}

export async function getTreeView(id: string, up = 2): Promise<TreeView | undefined> {
  const person = await getPerson(id);
  if (!person) return undefined;
  const [root, fams] = await Promise.all([buildNode(person, 0, up, new Set()), spouseFamilies(person)]);
  return {
    root,
    spouses: fams.map((f) => f.spouse).filter((s): s is PublicPerson => s !== undefined),
    children: fams.flatMap((f) => f.children),
  };
}
