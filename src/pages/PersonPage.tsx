import { useEffect, useState } from 'react';
import { FamilyBox } from '../components/FamilyBox';
import { Timeline } from '../components/Timeline';
import { getFamilyView, type FamilyView } from '../data/family';
import { buildTimeline } from '../lib/format';
import type { PublicPerson } from '../shared/types';
import { NotFound } from './NotFound';

function eyebrowOf(p: PublicPerson): string {
  if (p.living) return '';
  const find = (t: string) => p.events.find((e) => e.type === t);
  const part = (label: string, t: string) => {
    const e = find(t);
    if (!e || typeof e.year !== 'number') return '';
    return `${label} ${e.year}${e.place ? ` in ${e.place}` : ''}`;
  };
  return [part('Born', 'BIRT'), part('Died', 'DEAT')].filter(Boolean).join(' · ');
}

type State = { status: 'loading' } | { status: 'failed' } | { status: 'done'; view: FamilyView | undefined };

export function PersonPage({ id }: { id: string }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    getFamilyView(id)
      .then((view) => !cancelled && setState({ status: 'done', view }))
      .catch(() => !cancelled && setState({ status: 'failed' }));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const person = state.status === 'done' ? state.view?.person : undefined;
  useEffect(() => {
    if (person) document.title = `${person.name} · Bryan Family Tree`;
  }, [person]);

  if (state.status === 'loading') return <p className="lede">Loading…</p>;
  if (state.status === 'failed') return <p className="lede">This page could not be loaded. Please try again.</p>;
  if (!state.view) return <NotFound />;

  const { view } = state;
  const eyebrow = eyebrowOf(view.person);
  const rows = view.person.living ? [] : buildTimeline(view.person);

  return (
    <>
      <header className="stack person-hero">
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1 className="title person-title">{view.person.name}</h1>
        {view.person.living ? <p className="lede">Living person. Details are hidden.</p> : null}
      </header>
      <div className="person-columns">
        {rows.length > 0 ? (
          <div className="person-main">
            <Timeline rows={rows} />
          </div>
        ) : null}
        <div className="person-side">
          <FamilyBox view={view} />
        </div>
      </div>
    </>
  );
}
