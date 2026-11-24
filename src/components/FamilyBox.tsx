import { PersonLink } from './PersonLink';
import { yearsOf } from '../lib/format';
import { hrefFor } from '../lib/route';
import type { FamilyView, ParentFamily } from '../data/family';
import type { PublicPerson } from '../shared/types';

type Dir = 'up' | 'down' | 'right' | 'none';

const PATHS: Record<Exclude<Dir, 'none'>, string> = {
  up: 'M3 10l5-5 5 5',
  down: 'M3 6l5 5 5-5',
  right: 'M6 3l5 5-5 5',
};

function Row({ person, dir }: { person: PublicPerson; dir: Dir }) {
  const { birthYear, deathYear } = yearsOf(person);
  return (
    <li className="family-row">
      <span className="family-row-text">
        <PersonLink id={person.id} name={person.name} birthYear={birthYear} deathYear={deathYear} living={person.living} />
      </span>
      {dir !== 'none' ? (
        <svg className="family-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={PATHS[dir]} />
        </svg>
      ) : null}
    </li>
  );
}

function Group({ title, people, dir }: { title: string; people: PublicPerson[]; dir: Dir }) {
  if (people.length === 0) return null;
  return (
    <div className="family-group">
      <h3 className="family-heading">{title}</h3>
      <ul className="family-list">
        {people.map((p) => (
          <Row key={p.id} person={p} dir={dir} />
        ))}
      </ul>
    </div>
  );
}

const parentsOf = (f: ParentFamily) => [f.father, f.mother].filter((p): p is PublicPerson => p !== undefined);

export function FamilyBox({ view }: { view: FamilyView }) {
  const { person, mainParents, otherParentFamilies, spouseFamilies, siblings } = view;
  const main = mainParents ? parentsOf(mainParents) : [];
  const others = otherParentFamilies.map((f) => ({ id: f.familyId, parents: parentsOf(f) })).filter((f) => f.parents.length > 0);
  const spouses = spouseFamilies;
  const empty = main.length === 0 && others.length === 0 && spouses.length === 0 && siblings.length === 0;

  return (
    <section className="stack family-box" aria-labelledby="family-h" style={{ gap: 24 }}>
      <h2 className="section-title" id="family-h">Family</h2>
      {empty ? <p className="muted">No family links recorded.</p> : null}
      <Group title="Parents · go up" people={main} dir="up" />
      {others.map((f) => (
        <Group key={f.id} title="Also listed as a child of" people={f.parents} dir="up" />
      ))}
      {spouses.map((f) => {
        const year = f.marriage?.year;
        return (
          <div className="family-couple" key={f.familyId}>
            {f.spouse ? (
              <Group title={typeof year === 'number' ? `Spouse · married ${year}` : 'Spouse'} people={[f.spouse]} dir="right" />
            ) : (
              <h3 className="family-heading">Partner not recorded</h3>
            )}
            <Group title="Children · go down" people={f.children} dir="down" />
          </div>
        );
      })}
      <Group title="Siblings" people={siblings} dir="none" />
      <a className="button-link" href={hrefFor({ name: 'tree', id: person.id })}>
        See {person.givenName || person.name} in the family tree
      </a>
    </section>
  );
}
