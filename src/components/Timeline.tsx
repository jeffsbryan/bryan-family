import type { TimelineRow } from '../lib/format';

export function Timeline({ rows }: { rows: TimelineRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="stack" aria-labelledby="timeline-h" style={{ gap: 16 }}>
      <h2 className="section-title" id="timeline-h">Life timeline</h2>
      <ol className="timeline" aria-labelledby="timeline-h">
        {rows.map((r, i) => (
          <li className="timeline-row" key={i}>
            <span className="timeline-year">{r.year ?? ''}</span>
            <span>
              <span className="timeline-title">{r.title}</span>
              {r.detail ? <span className="timeline-detail">{r.detail}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
