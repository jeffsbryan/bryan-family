import { useRef, useState } from 'react';
import { searchPeople } from '../data/api';
import type { SearchEntry } from '../shared/types';
import { PersonLink } from './PersonLink';

export function SearchBox() {
  const [query, setQuery] = useState('');
  const [done, setDone] = useState<{ query: string; results: SearchEntry[]; error?: boolean }>({ query: '', results: [] });
  const latest = useRef(0);

  function onChange(value: string) {
    setQuery(value);
    const ticket = ++latest.current;
    if (value.trim().length < 2) {
      setDone({ query: value, results: [] });
      return;
    }
    searchPeople(value)
      .then((r) => {
        if (ticket === latest.current) setDone({ query: value, results: r });
      })
      .catch(() => {
        if (ticket === latest.current) setDone({ query: value, results: [], error: true });
      });
  }

  const active = query.trim().length >= 2;
  const results = active ? done.results : [];
  return (
    <div>
      <input
        className="search-input"
        type="search"
        aria-label="Search for a person"
        placeholder="Type a name"
        autoComplete="off"
        value={query}
        onChange={(e) => onChange(e.target.value)}
      />
      <div aria-live="polite">
        {active && done.query === query && done.error && (
          <p className="results-empty" role="alert">
            Search is unavailable right now. Please try again.
          </p>
        )}
        {active && done.query === query && !done.error && results.length === 0 && (
          <p className="results-empty" role="status">
            No one found
          </p>
        )}
        {results.length > 0 && (
          <ul className="results">
            {results.map(([id, name, born, died, living, place]) => {
              return (
                <li className="result-row" key={id}>
                  <PersonLink id={id} name={name} birthYear={born} deathYear={died} living={living} place={place} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
