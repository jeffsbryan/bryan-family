import { hrefFor } from '../lib/route';

export function NotFound() {
  return (
    <div className="stack">
      <h1 className="title">Page not found</h1>
      <p className="lede">We could not find that page.</p>
      <a className="back-link" href={hrefFor({ name: 'home' })}>
        Back to search
      </a>
    </div>
  );
}
