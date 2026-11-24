export interface RawEvent {
  type: string;
  label: string;
  date?: string;
  year?: number;
  month?: number;
  day?: number;
  place?: string;
  value?: string;
}

export interface RawIndividual {
  id: string;
  name: string;
  givenName: string;
  surname: string;
  sex: string;
  events: RawEvent[];
  childOfFamilies: string[];
  spouseOfFamilies: string[];
  occupation?: string;
}

export interface RawFamily {
  id: string;
  husband?: string;
  wife?: string;
  children: string[];
  marriage?: RawEvent;
  divorce?: RawEvent;
}

export interface RawFile {
  format: string;
  individuals: RawIndividual[];
  families: RawFamily[];
}

/** RawIndividual plus `living`. For living people: events [], sex 'U', no occupation. */
export interface PublicPerson extends RawIndividual {
  living: boolean;
}

export type PublicFamily = RawFamily;

export interface PublicFile {
  format: string;
  individuals: PublicPerson[];
  families: PublicFamily[];
}

export type Overrides = Record<string, 'living' | 'deceased'>;

export type SearchEntry = [
  id: string,
  name: string,
  birthYear: number | null,
  deathYear: number | null,
  living: boolean,
  /** Normalized BIRT place cut to its first two comma-separated parts; null for living people or when unknown. */
  place: string | null,
];

export interface Manifest {
  generatedAt: string;
  personCount: number;
  familyCount: number;
  bucketCount: number;
  topSurnames: { surname: string; count: number }[];
}
