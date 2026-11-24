import { lifespan, yearsOf } from '../lib/format';
import { hrefFor } from '../lib/route';
import type { PublicPerson } from '../shared/types';

function Chevron() {
  return (
    <svg
      className="tree-chevron"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 3L5 8l5 5" />
    </svg>
  );
}

export interface TreeCardProps {
  person: PublicPerson;
  /** The filled accent card for the person the tree is centered on. */
  selected?: boolean;
  /** True when this person has parents that are not shown yet. */
  hasMoreAncestors?: boolean;
}

export function TreeCard({ person, selected = false, hasMoreAncestors = false }: TreeCardProps) {
  const { birthYear, deathYear } = yearsOf(person);
  const span = lifespan(birthYear, deathYear, person.living);
  const cls = ['tree-card', selected ? 'is-selected' : '', person.living ? 'is-living' : ''].filter(Boolean).join(' ');
  const body = (
    <>
      {hasMoreAncestors ? (
        <span className="tree-more">
          <Chevron />
          <span className="sr-only">More ancestors</span>
        </span>
      ) : null}
      {hasMoreAncestors ? ' ' : null}
      <span className="tree-card-text">
        <span className="tree-card-name">{person.name}</span>
        {' '}
        {person.living ? (
          <span className="tree-card-sub">Living person</span>
        ) : span ? (
          <span className="tree-card-sub">{span}</span>
        ) : null}
      </span>
    </>
  );
  return (
    <div className={cls}>
      {selected ? (
        <div className="tree-card-main" aria-current="true">
          {body}
        </div>
      ) : (
        <a className="tree-card-main" href={hrefFor({ name: 'tree', id: person.id })}>
          {body}
        </a>
      )}
      <a
        className="tree-card-details"
        href={hrefFor({ name: 'person', id: person.id })}
        aria-label={`Details for ${person.name}`}
      >
        Details
      </a>
    </div>
  );
}
