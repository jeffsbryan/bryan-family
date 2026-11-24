import { birthYear } from '../shared/living';
import type { PublicPerson } from '../shared/types';

export function yearsOf(p: PublicPerson): { birthYear: number | null; deathYear: number | null } {
  if (p.living) return { birthYear: null, deathYear: null };
  const death = p.events.find((e) => e.type === 'DEAT' && typeof e.year === 'number');
  return { birthYear: birthYear(p) ?? null, deathYear: death?.year ?? null };
}

export function lifespan(birthYear: number | null, deathYear: number | null, living: boolean): string {
  if (living) return '';
  if (birthYear !== null && deathYear !== null) return `${birthYear} – ${deathYear}`;
  if (birthYear !== null) return `${birthYear} –`;
  if (deathYear !== null) return `– ${deathYear}`;
  return '';
}

export interface TimelineRow {
  year?: number;
  title: string;
  detail?: string;
}

function occupationOf(value: string | undefined): string | undefined {
  const m = value?.match(/Occupation:\s*([^;]+)/);
  const x = m?.[1].trim();
  return x ? `Occupation: ${x}` : undefined;
}

export function buildTimeline(person: PublicPerson): TimelineRow[] {
  const rows: TimelineRow[] = [];
  const seen = new Set<string>();
  for (const e of person.events) {
    const row: TimelineRow = { title: e.label };
    if (typeof e.year === 'number') row.year = e.year;
    switch (e.type) {
      case 'BIRT': case 'DEAT': case 'BURI':
        row.title = e.type === 'BIRT' ? 'Born' : e.type === 'DEAT' ? 'Died' : 'Buried';
        if (e.place) row.detail = e.place;
        break;
      case 'RESI': {
        row.title = e.place ? `Lived in ${e.place}` : 'Residence';
        const occ = occupationOf(e.value);
        if (occ) row.detail = occ;
        break;
      }
    }
    const key = JSON.stringify([row.title, row.year ?? null, row.detail ?? null]);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (a.r.year ?? Infinity) - (b.r.year ?? Infinity) || a.i - b.i)
    .map(({ r }) => r);
}
