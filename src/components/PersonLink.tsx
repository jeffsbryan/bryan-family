import { lifespan } from '../lib/format';
import { hrefFor } from '../lib/route';

export interface PersonLinkProps {
  id: string;
  name: string;
  birthYear?: number | null;
  deathYear?: number | null;
  living?: boolean;
}

export function PersonLink({ id, name, birthYear = null, deathYear = null, living = false }: PersonLinkProps) {
  const span = lifespan(birthYear, deathYear, living);
  return (
    <>
      <a className="person-link" href={hrefFor({ name: 'person', id })}>
        {name}
      </a>
      {living ? <span className="person-sub">Living person</span> : span ? <span className="person-sub">{span}</span> : null}
    </>
  );
}
