import { useEffect, useState } from 'react';
import { loadShard } from '../data/api';
import { PersonLink } from '../components/PersonLink';
import { hrefFor } from '../lib/route';
import { shardKey } from '../shared/keys';
import type { SearchEntry } from '../shared/types';

export function SurnamePage({ surname }: { surname: string }) {
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setFailed(false);
    loadShard(shardKey(surname))
      .then((all) => {
        if (cancelled) return;
        const s = surname.toLowerCase();
        setEntries(all.filter((e) => e[1].toLowerCase().endsWith(s)).sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0])));
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [surname]);

  return (
    <>
      <div className="stack">
        <a className="back-link" href={hrefFor({ name: 'home' })}>
          Back to search
        </a>
        <h1 className="title">{surname}</h1>
      </div>
      {failed ? (
        <p className="lede">Something went wrong loading this surname.</p>
      ) : entries === null ? (
        <p className="lede">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="lede">No one found</p>
      ) : (
        <ul className="results" style={{ margin: 0 }}>
          {entries.map(([id, name, born, died, living, place]) => (
            <li className="result-row" key={id}>
              <PersonLink id={id} name={name} birthYear={born} deathYear={died} living={living} place={place} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
