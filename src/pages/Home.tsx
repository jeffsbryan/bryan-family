import { useEffect, useState } from 'react';
import { getManifest } from '../data/api';
import { SearchBox } from '../components/SearchBox';
import { hrefFor } from '../lib/route';
import type { Manifest } from '../shared/types';

export function Home() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  useEffect(() => {
    let cancelled = false;
    getManifest()
      .then((m) => !cancelled && setManifest(m))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const fmt = new Intl.NumberFormat('en-US');
  return (
    <>
      <div className="stack">
        <h1 className="title">Find a relative</h1>
        <p className="lede">
          {manifest && `${fmt.format(manifest.personCount)} people in ${fmt.format(manifest.familyCount)} families. `}
          Type a name, then walk up to their parents or down to their children.
        </p>
      </div>
      <SearchBox />
      {manifest && manifest.topSurnames.length > 0 && (
        <section className="stack" aria-labelledby="browse-surname">
          <h2 className="eyebrow" id="browse-surname" style={{ margin: 0 }}>
            Or browse by surname
          </h2>
          <ul className="chips">
            {manifest.topSurnames.slice(0, 12).map(({ surname, count }) => (
              <li key={surname}>
                <a className="chip" href={hrefFor({ name: 'surname', surname })}>
                  {surname} <span className="chip-count">{fmt.format(count)}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
