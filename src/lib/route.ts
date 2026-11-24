export type Route =
  | { name: 'home' }
  | { name: 'person'; id: string }
  | { name: 'tree'; id: string }
  | { name: 'surname'; surname: string }
  | { name: 'notfound' };

const NOT_FOUND: Route = { name: 'notfound' };

function decode(s: string): string | null {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '');
  if (path === '' || path === '/') return { name: 'home' };
  const parts = path.split('/'); // '/person/I4' -> ['', 'person', 'I4']
  if (parts[0] !== '' || parts.length !== 3 || parts[2] === '') return NOT_FOUND;
  const value = decode(parts[2]);
  if (!value) return NOT_FOUND;
  switch (parts[1]) {
    case 'person':
      return { name: 'person', id: value };
    case 'tree':
      return { name: 'tree', id: value };
    case 'surname':
      return { name: 'surname', surname: value };
    default:
      return NOT_FOUND;
  }
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'person':
      return `#/person/${encodeURIComponent(route.id)}`;
    case 'tree':
      return `#/tree/${encodeURIComponent(route.id)}`;
    case 'surname':
      return `#/surname/${encodeURIComponent(route.surname)}`;
    default:
      return '#/';
  }
}
