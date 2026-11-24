import { lifespan } from '../lib/format';
import { hrefFor } from '../lib/route';

export interface PersonLinkProps {
  id: string;
  name: string;
  birthYear?: number | null;
  deathYear?: number | null;
  living?: boolean;
  place?: string | null;
}

export function PersonLink({ id, name, birthYear = null, deathYear = null, living = false, place = null }: PersonLinkProps) {
  const sub = living ? 'Living person' : [lifespan(birthYear, deathYear, living), place ?? ''].filter(Boolean).join(' · ');
  return (
    <>
      <a className="person-link" href={hrefFor({ name: 'person', id })}>
        {name}
      </a>
      {sub ? <span className="person-sub">{sub}</span> : null}
    </>
  );
}
