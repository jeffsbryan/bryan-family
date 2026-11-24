import { useEffect, useState, type CSSProperties } from 'react';
import { TreeCard } from '../components/TreeCard';
import { getTreeView, type TreeNode, type TreeView } from '../data/family';
import { lifespan, yearsOf } from '../lib/format';
import { hrefFor } from '../lib/route';
import { NotFound } from './NotFound';

const NEUTRAL_TITLE = 'Family tree · Bryan Family Tree';

type State = { status: 'loading' } | { status: 'failed' } | { status: 'done'; view: TreeView | undefined };

/** Number of ancestor levels shown above this node. */
function depthOf(node: TreeNode): number {
  return node.parents.length ? 1 + Math.max(...node.parents.map(depthOf)) : 0;
}

function Ancestors({
  nodes,
  levels,
  childName,
  depth = 1,
}: {
  nodes: TreeNode[];
  levels: number;
  childName: string;
  depth?: number;
}) {
  return (
    <ul className="tree-parents" aria-label={`Parents of ${childName}`}>
      {nodes.map((n) => {
        const above = levels - 1;
        return (
          <li key={n.person.id} className={n.parents.length ? 'tree-node has-parents' : 'tree-node'}>
            <TreeCard person={n.person} hasMoreAncestors={n.hasMoreAncestors} />
            {n.parents.length ? (
              <>
                <h3 className="tree-gp-label">{depth === 1 ? 'Grandparents' : 'Earlier ancestors'}</h3>
                <Ancestors nodes={n.parents} levels={above} childName={n.person.name} depth={depth + 1} />
              </>
            ) : above > 0 ? (
              <div className="tree-ghost" aria-hidden="true" style={{ '--g': above } as CSSProperties} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function colLabel(level: number): string {
  return level === 1 ? 'Parents' : level === 2 ? 'Grandparents' : 'Earlier ancestors';
}

function TreeBody({ view }: { view: TreeView }) {
  const { root, spouses, children } = view;
  const levels = depthOf(root);
  const heads: number[] = [];
  for (let l = levels; l >= 1; l--) heads.push(l);

  return (
    <>
      <header className="stack">
        <h1 className="title tree-title">Walking the tree</h1>
        <p className="lede tree-lede">
          Centered on {root.person.name}. Select any card to move the tree to that person. Arrows mean more people
          continue past that card.
        </p>
      </header>
      <div className="tree" style={{ '--spouses': spouses.length } as CSSProperties}>
        <div className="tree-colheads" aria-hidden="true">
          {heads.map((l) => (
            <div key={l} className="tree-colhead">
              {colLabel(l)}
            </div>
          ))}
          <div className="tree-colhead is-sel">Selected person</div>
          {children.length ? <div className="tree-colhead">Children</div> : null}
        </div>
        <div className="tree-body">
          {levels > 0 ? (
            <>
              <section className="tree-anc">
                <h2 className="tree-h">Parents</h2>
                <Ancestors nodes={root.parents} levels={levels} childName={root.person.name} />
              </section>
              <div className="tree-conn" aria-hidden="true" />
            </>
          ) : null}
          <section className="tree-sel">
            <h2 className="tree-h">Selected person</h2>
            <TreeCard person={root.person} selected />
            {spouses.length ? (
              <div className="tree-spouses">
                <h2 className="tree-spouse-label">{spouses.length === 1 ? 'Spouse' : 'Spouses'}</h2>
                <ul className="tree-spouse-list">
                  {spouses.map((s) => {
                    const { birthYear, deathYear } = yearsOf(s);
                    const span = lifespan(birthYear, deathYear, s.living);
                    return (
                      <li key={s.id}>
                        <a className="tree-spouse" href={hrefFor({ name: 'tree', id: s.id })}>
                          <span className="tree-spouse-name">{s.name}</span>
                          {span ? <span className="tree-card-sub">{span}</span> : null}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </section>
          {children.length ? (
            <>
              <div className="tree-conn" aria-hidden="true" />
              <section className="tree-kids">
                <h2 className="tree-h">Children</h2>
                <ul className="tree-kid-list">
                  {children.map((c) => (
                    <li key={c.id} className="tree-kid">
                      <TreeCard person={c} />
                    </li>
                  ))}
                </ul>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

export function TreePage({ id }: { id: string }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    getTreeView(id)
      .then((view) => !cancelled && setState({ status: 'done', view }))
      .catch(() => !cancelled && setState({ status: 'failed' }));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const person = state.status === 'done' ? state.view?.root.person : undefined;
  useEffect(() => {
    document.title = person ? `${person.name} · Family tree · Bryan Family Tree` : NEUTRAL_TITLE;
  }, [person]);

  if (state.status === 'loading') return <p className="lede">Loading…</p>;
  if (state.status === 'failed') return <p className="lede">This page could not be loaded. Please try again.</p>;
  if (!state.view) return <NotFound />;
  return <TreeBody view={state.view} />;
}
