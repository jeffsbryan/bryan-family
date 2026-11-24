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
