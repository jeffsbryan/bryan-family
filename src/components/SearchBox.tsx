import { useRef, useState } from 'react';
import { searchPeople } from '../data/api';
import type { SearchEntry } from '../shared/types';
import { PersonLink } from './PersonLink';

export function SearchBox() {
  const [query, setQuery] = useState('');
  const [done, setDone] = useState<{ query: string; results: SearchEntry[] }>({ query: '', results: [] });
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
        if (ticket === latest.current) setDone({ query: value, results: [] });
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
      {active && done.query === query && results.length === 0 && <p className="results-empty">No one found</p>}
      {results.length > 0 && (
        <ul className="results">
          {results.map(([id, name, born, died, living]) => {
            return (
              <li className="result-row" key={id}>
                <PersonLink id={id} name={name} birthYear={born} deathYear={died} living={living} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
