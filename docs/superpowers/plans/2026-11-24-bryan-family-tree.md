# Bryan Family Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static family-tree website, built from an FTM JSON export, with name search, a person page first, and click-through up/down the tree, hosted on AWS Amplify.

**Architecture:** A local `sanitize` script strips living people's details and writes `data/family.public.json` (the only data file committed). Amplify's build runs `build-data`, which splits that file into bucket files, search shards and a manifest under `public/data/`, then Vite builds a React single-page app that fetches only what it needs and routes by hash (`/#/person/I4`).

**Tech Stack:** Vite, TypeScript, React, Vitest, @testing-library/react, tsx (to run scripts).

**Spec:** `docs/superpowers/specs/2026-11-23-bryan-family-tree-design.md` (copy of the approved design; Task 1 adds it). Layout mockups: https://claude.ai/artifact/DnNUgwe5HDeqyHrcU4NpAz (person page, tree view, home and search; the author can export them).

## Global Constraints

- Living = recorded birth year **after 1940** (cutoff constant `LIVING_AFTER_YEAR = 1940`, one place). Living people show **name only**; no dates, places, events, occupation, marriage details, or sex.
- The GitHub repo is **public**. The raw FTM export is never committed (`.gitignore`); only `data/family.public.json` is.
- Static site only. Links are hash links: `/#/person/I4`, `/#/tree/I4`, `/#/surname/Bryan`, `/#/` home.
- Never ship the whole dataset to the browser; fetch buckets and search shards on demand.
- Tree view defaults to 2 generations up and 1 down. A person's first parent family is the main one; others are listed as "Also listed as a child of...".
- Override list `data/overrides.json`: `{ "I123": "living" | "deceased" }`.
- `noindex` (meta tag and `X-Robots-Tag` header); no password.
- Works at phone width, light and dark. Type: Newsreader (names), Inter (text). Light tokens: bg `#F2F5F3`, card `#FFFFFF`, ink `#14211E`, muted `#4B5C58`, line `#CAD5D1`, accent `#1D5B55`, tint `#E8EFEC`. Dark tokens: bg `#101715`, card `#18221F`, ink `#E6EEEB`, muted `#A7B7B2`, line `#2C3B37`, accent `#6FBFB5`, tint `#1C2825`.
- Photos are out of scope for this plan. Do not add photo UI.

## Review Focus

1. **Cutoff boundary and missing birth year:** born 1940 is shown, 1941 hidden; a person with no BIRT year but a BAPM/CHR year after 1940 is hidden (birth year falls back to the earliest BAPM/CHR year).
2. **Leaks through families:** a family's marriage/divorce is removed when either spouse is living; a living spouse in a deceased person's Family box shows name only.
3. **Duplicate events:** the file repeats identical RESI events (Oliver Bryan has the same 1910 record three times); the timeline shows each once.
4. **Missing references:** an unknown person ID, a family with no husband or wife, a person in no family, and a bad hash route show a friendly not-found view and never crash.
5. **Search edge cases:** 405 people have a blank surname (findable by given name); names like `O'Brien` and accented letters match; one-character and empty queries return nothing.

---

## File Structure

```
src/shared/types.ts        raw + public data shapes
src/shared/keys.ts         bucketOf, shardKey (used by scripts and browser)
src/shared/living.ts       birthYear, isLiving
src/shared/places.ts       normalizePlace, cleanEvents
scripts/lib/sanitize.ts    sanitize(), sanitizeFile()
scripts/lib/build-data.ts  buildData()
scripts/lib/privacy.ts     collectSensitiveStrings(), findLeaks()
scripts/sanitize.ts        CLI: raw json -> data/family.public.json
scripts/build-data.ts      CLI: public json -> public/data/
scripts/verify-privacy.ts  CLI: raw json + dist -> leak report
src/data/api.ts            fetch + cache + search
src/data/family.ts         getFamilyView, getTreeView
src/lib/route.ts           parseHash, hrefFor
src/lib/format.ts          lifespan, buildTimeline
src/components/            Layout, SearchBox, PersonLink, Timeline, FamilyBox, TreeCard
src/pages/                 Home, SurnamePage, PersonPage, TreePage, NotFound
src/styles/tokens.css      color tokens, light + dark
tests/fixtures/raw-mini.json   hand-made raw file (see Task 2)
data/overrides.json, data/family.public.json
amplify.yml, customHttp.yml, .gitignore, index.html
```

---

### Task 1: Scaffold, shared types and keys

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore` entries, `amplify.yml`, `customHttp.yml`, `src/shared/types.ts`, `src/shared/keys.ts`, `docs/superpowers/specs/2026-11-23-bryan-family-tree-design.md`
- Test: `tests/keys.test.ts`

**Interfaces:**
- Produces (`src/shared/types.ts`): `RawEvent {type; label; date?; year?; month?; day?; place?; value?}`, `RawIndividual {id; name; givenName; surname; sex; events: RawEvent[]; childOfFamilies: string[]; spouseOfFamilies: string[]; occupation?}`, `RawFamily {id; husband?; wife?; children: string[]; marriage?: RawEvent; divorce?: RawEvent}`, `RawFile {format: string; individuals: RawIndividual[]; families: RawFamily[]}`, `PublicPerson` (= RawIndividual plus `living: boolean`; for living people `events` is `[]`, `sex` is `'U'`, no `occupation`), `PublicFamily` (= RawFamily), `PublicFile {format; individuals: PublicPerson[]; families: PublicFamily[]}`, `Overrides = Record<string,'living'|'deceased'>`, `SearchEntry = [id: string, name: string, birthYear: number | null, deathYear: number | null]`, `Manifest {generatedAt: string; personCount: number; familyCount: number; bucketCount: number; topSurnames: {surname: string; count: number}[]}`.
- Produces (`src/shared/keys.ts`): `BUCKET_COUNT = 200`; `bucketOf(id: string, bucketCount?: number): number`; `shardKey(name: string): string`.

- [ ] **Step 1: Inspect the existing repo.** Run `ls -la && git log --oneline | head && cat package.json amplify.yml 2>/dev/null`. Keep anything already there that doesn't conflict; adapt this task's files to it instead of overwriting.
- [ ] **Step 2: Write the failing test** `tests/keys.test.ts`:
  `bucketOf('I4')===4`; `bucketOf('I200')===0`; `bucketOf('F12510')===110`; `shardKey("O'Brien")==='ob'`; `shardKey('Éa')==='ea'`; `shardKey('')==='__'`; `shardKey('X')==='x_'`.
- [ ] **Step 3: Run it** (`npx vitest run tests/keys.test.ts`); expect FAIL (module missing).
- [ ] **Step 4: Scaffold and implement.** `package.json` scripts: `dev`, `build` (`tsc --noEmit && vite build`), `test` (`vitest run`), `sanitize` (`tsx scripts/sanitize.ts`), `build:data` (`tsx scripts/build-data.ts`), `verify:privacy` (`tsx scripts/verify-privacy.ts`). Vitest uses jsdom and `@testing-library/jest-dom`. `bucketOf` = numeric part of the id mod `bucketCount`. `shardKey` = lowercase, NFD with diacritics stripped, keep only a-z, first two letters, right-padded with `_`. `index.html` has `<meta name="robots" content="noindex">` and the Google Fonts link for Newsreader and Inter. `.gitignore` adds `node_modules/`, `dist/`, `public/data/`, `data/raw/`, `*.ged`, `Bryan_*.json`. `amplify.yml`: preBuild `npm ci && npm test`, build `npm run build:data && npm run build`, artifacts base `dist`. `customHttp.yml`: header `X-Robots-Tag: noindex` for `**/*`. Copy the approved design doc to the spec path above (the author supplies it).
- [ ] **Step 5: Run `npx vitest run`**; expect PASS.
- [ ] **Step 6: Commit** `git add -A && git commit -m "chore: scaffold Vite app, shared types and keys"`.

### Task 2: Living rule

**Files:**
- Create: `src/shared/living.ts`, `tests/fixtures/raw-mini.json`
- Test: `tests/living.test.ts`

**Interfaces:**
- Consumes: `RawIndividual`, `Overrides`.
- Produces: `LIVING_AFTER_YEAR = 1940`; `birthYear(ind: RawIndividual): number | undefined` (BIRT year, else earliest BAPM/CHR year); `isLiving(ind: RawIndividual, overrides?: Overrides, cutoff?: number): boolean` (override wins; else `birthYear > cutoff`; no year means not living).

**Fixture `tests/fixtures/raw-mini.json`** (format `gedfile.com/json/v1`; build it from this table; sex and events as in the real file):

| id | name | events | childOf | spouseOf |
|---|---|---|---|---|
| I1 | Stephen Thomas Bryan | BIRT 1948 "Scranton PA"; RESI 1972 "English Village" value "Employer: W. B. Saunders Publishing Co.; Advertising Copywriter Occupation: Advertising Copywriter"; occupation "Advertising Copywriter" | F1 | F3 |
| I2 | Hayden Gitt Bryan | BIRT 1908 "Atlantic City NJ"; DEAT 1960 "Philadelphia PA" | F2 | F1 |
| I3 | Pauline Agnes Thorp | BIRT 1918; DEAT 1973 | none | F1 |
| I4 | Oliver Bryan | BIRT 1870 "New Haven CT"; DEAT 1931; the same RESI 1910 "Atlantic City Ward 3, Atlantic, New Jersey, United States" three times | F4 | F2 |
| I5 | Bessie Ida Gitt | BIRT 1872; DEAT 1946 | none | F2 |
| I6 | Benjamin Sherman Bryan | BIRT 1826; DEAT 1896 | none | F4, F6 |
| I7 | Maria Louise Hayden | BIRT 1840; DEAT 1933 | none | F4, F6 |
| I8 | "Mary" (surname blank) | no events | none | none |
| I9 | Edwin Bryan | BIRT 1938, no death | F2, F6 | none |
| I10 | Ray Bryan | BIRT 1940 | none | none |
| I11 | Lee Bryan | BIRT 1941; DEAT 1990 | none | none |
| I12 | Sam Bryan | no BIRT; CHR 1955 | F5 | none |
| I13 | Pat O'Brien | BIRT 1900; DEAT 1980 | none | F5 |
| I14 | Carol Bryan | BIRT 1950 | none | F3 |

Families: F1 husband I2, wife I3, marriage 1943 "Camden NJ", children [I1]. F2 husband I4, wife I5, children [I2, I9]. F3 husband I1, wife I14, marriage 1972 "Palmyra PA", children []. F4 husband I6, wife I7, children [I4]. F5 husband I13 only, children [I12]. F6 husband I6, wife I7, children [I9].

- [ ] **Step 1: Write failing tests** in `tests/living.test.ts` using the fixture: `isLiving(I10)===false` (1940), `isLiving(I11)===true` (1941, though deceased), `isLiving(I12)===true` (CHR 1955 fallback), `isLiving(I9)===false` (1938, no death), `isLiving(I8)===false`, `birthYear(I12)===1955`, override `{I1:'deceased'}` makes I1 not living, `{I9:'living'}` makes I9 living, and `isLiving(I10, {}, 1930)===true`.
- [ ] **Step 2: Run** `npx vitest run tests/living.test.ts`; expect FAIL.
- [ ] **Step 3: Implement** `birthYear`, `isLiving` in `src/shared/living.ts`.
- [ ] **Step 4: Run**; expect PASS.
- [ ] **Step 5: Commit** `git commit -am "feat: living-person rule and test fixture"`.

### Task 3: Sanitize (strip living people)

**Files:**
- Create: `scripts/lib/sanitize.ts`, `scripts/sanitize.ts`, `data/overrides.json` (`{}`)
- Test: `tests/sanitize.test.ts`

**Interfaces:**
- Consumes: `isLiving`, `birthYear`, `RawFile`, `Overrides`, `PublicFile`.
- Produces: `SanitizeReport {living: number; livingWithDeathRecord: number; bornAfter1925UpTo1940NoDeath: {id: string; name: string}[]; overridesApplied: number}`; `sanitize(raw: RawFile, overrides: Overrides, cutoff?: number): {file: PublicFile; report: SanitizeReport}`; `sanitizeFile(rawPath: string, outPath: string, overridesPath: string): SanitizeReport`.

- [ ] **Step 1: Write failing tests** in `tests/sanitize.test.ts` on the fixture:
  - Every living person (I1, I11, I12, I14) has `events: []`, `sex: 'U'`, `living: true`, no `occupation`, but keeps `id`, `name`, `givenName`, `surname`, `childOfFamilies`, `spouseOfFamilies`.
  - F3 (I1 + I14) has no `marriage` and no `divorce`; F1 (both deceased) is unchanged; a family with one living spouse and one deceased spouse also loses `marriage`.
  - `JSON.stringify(file)` contains none of: `"Scranton PA"`, `"1948"`, `"English Village"`, `"Saunders"`, `"Palmyra"`, `"Advertising Copywriter"`.
  - Deceased people are unchanged apart from `living: false`.
  - `report.living===4`, `report.livingWithDeathRecord===1` (I11), `report.bornAfter1925UpTo1940NoDeath` has exactly I9 and I10 (both named; I10 was born 1940 with no death record).
  - Output objects are built from an explicit whitelist: a raw individual with an extra field `secretNote` produces output without it.
- [ ] **Step 2: Run**; expect FAIL.
- [ ] **Step 3: Implement** `sanitize` (whitelist copy, never spread) and `sanitizeFile` (read, apply `data/overrides.json`, write, return report). `scripts/sanitize.ts` takes the raw path as its argument, writes `data/family.public.json`, and prints the report: counts plus the id and name of each person born 1926–1940 with no death record.
- [ ] **Step 4: Run**; expect PASS.
- [ ] **Step 5: Commit** `git commit -am "feat: sanitize script strips living people's details"`.

### Task 4: Place and event cleanup

**Files:**
- Create: `src/shared/places.ts`
- Test: `tests/places.test.ts`

**Interfaces:**
- Consumes: `RawEvent`.
- Produces: `normalizePlace(place: string): string` (trim; drop a trailing `, United States` or `, USA`; collapse repeated spaces); `cleanEvents(events: RawEvent[]): RawEvent[]` (normalizes each `place`; removes exact duplicates by `type|year|date|place|value`; keeps order).

- [ ] **Step 1: Write failing tests:** `normalizePlace('Atlantic City Ward 3, Atlantic, New Jersey, United States')==='Atlantic City Ward 3, Atlantic, New Jersey'`; `normalizePlace('Philadelphia PA')==='Philadelphia PA'`; `normalizePlace('Lower Merion, Montgomery, Pennsylvania, USA')==='Lower Merion, Montgomery, Pennsylvania'`; `cleanEvents` on Oliver's three identical 1910 events returns one, and keeps two events that differ only in `value`.
- [ ] **Step 2: Run**; expect FAIL.
- [ ] **Step 3: Implement** both functions.
- [ ] **Step 4: Run**; expect PASS.
- [ ] **Step 5: Commit** `git commit -am "feat: place normalization and duplicate-event cleanup"`.

### Task 5: Build the data files

**Files:**
- Create: `scripts/lib/build-data.ts`, `scripts/build-data.ts`
- Test: `tests/build-data.test.ts`

**Interfaces:**
- Consumes: `PublicFile`, `bucketOf`, `shardKey`, `cleanEvents`, `BUCKET_COUNT`.
- Produces: `buildData(pub: PublicFile, now?: Date): Map<string, unknown>` mapping an output path (relative to `public/data/`) to JSON: `manifest.json` (`Manifest`; `topSurnames` = 30 most common non-blank surnames), `people/{n}.json` (`Record<string, PublicPerson>`, events passed through `cleanEvents`), `families/{n}.json` (`Record<string, PublicFamily>`), `search/{key}.json` (`SearchEntry[]`). Each person appears in the shard for `shardKey(surname)` and, when the first given name's key differs, also in the shard for `shardKey(firstGivenName)`. Years are `null` for living people.

- [ ] **Step 1: Write failing tests** on the sanitized fixture: person I4 is in `people/4.json` with one 1910 RESI event whose place has no `United States`; family F4 is in `families/4.json`; `search/br.json` contains Bryan entries, including I1 as `['I1','Stephen Thomas Bryan',null,null]`; `search/st.json` also contains I1 (first given name); both `search/__.json` and `search/ma.json` contain Mary (I8); `manifest.topSurnames` has no blank surname and `Bryan` first; `JSON.stringify` of all outputs contains none of the sensitive strings from Task 3.
- [ ] **Step 2: Run**; expect FAIL.
- [ ] **Step 3: Implement** `buildData`. `scripts/build-data.ts` reads `data/family.public.json`, empties and rewrites `public/data/`, and prints file count and the largest file size.
- [ ] **Step 4: Run**; expect PASS.
- [ ] **Step 5: Commit** `git commit -am "feat: build bucket, search and manifest files"`.

### Task 6: Data access and search

**Files:**
- Create: `src/data/api.ts`
- Test: `tests/api.test.ts`

**Interfaces:**
- Consumes: `bucketOf`, `shardKey`, `BUCKET_COUNT`, types.
- Produces: `getManifest(): Promise<Manifest>`; `getPerson(id: string): Promise<PublicPerson | undefined>`; `getFamily(id: string): Promise<PublicFamily | undefined>`; `loadShard(key: string): Promise<SearchEntry[]>`; `matchEntries(entries: SearchEntry[], query: string): SearchEntry[]` (pure); `searchPeople(query: string, limit?: number): Promise<SearchEntry[]>` (default limit 25). Fetches `import.meta.env.BASE_URL + 'data/...'`, caches per URL, and treats a 404 as `undefined` / `[]`.

- [ ] **Step 1: Write failing tests** (stub `fetch`): `getPerson('I4')` fetches `people/4.json` once even when called twice; unknown id gives `undefined`; `matchEntries` is case-insensitive, matches every query token as a prefix of some name word, ignores accents and apostrophes (`"obrien"` and `"o'brien"` both find Pat O'Brien), and ranks exact-surname matches first; `searchPeople('')`, `searchPeople('b')` return `[]`; `searchPeople('hay')` loads only shard `ha`; `searchPeople('Mary')` finds the blank-surname person; a living entry is returned with null years.
- [ ] **Step 2: Run**; expect FAIL.
- [ ] **Step 3: Implement** with a `Map<string, Promise<...>>` cache.
- [ ] **Step 4: Run**; expect PASS.
- [ ] **Step 5: Commit** `git commit -am "feat: data access and name search"`.

### Task 7: Family view and tree model

**Files:**
- Create: `src/data/family.ts`
- Test: `tests/family.test.ts`

**Interfaces:**
- Consumes: `getPerson`, `getFamily` (mock `./api` in tests with the sanitized fixture).
- Produces:
  `FamilyView {person: PublicPerson; mainParents: {familyId: string; father?: PublicPerson; mother?: PublicPerson} | null; otherParentFamilies: {familyId: string; father?: PublicPerson; mother?: PublicPerson}[]; spouseFamilies: {familyId: string; spouse?: PublicPerson; marriage?: RawEvent; children: PublicPerson[]}[]; siblings: PublicPerson[]}`;
  `getFamilyView(id: string): Promise<FamilyView | undefined>`;
  `TreeNode {person: PublicPerson; parents: TreeNode[]; hasMoreAncestors: boolean}`; `TreeView {root: TreeNode; spouses: PublicPerson[]; children: PublicPerson[]}`; `getTreeView(id: string, up?: number): Promise<TreeView | undefined>` (default `up` 2; children are one generation).

- [ ] **Step 1: Write failing tests:** I9 has `mainParents` F2 and `otherParentFamilies` [F6]; I12 has father I13 and no mother, and does not throw; I8 (no families) gives empty `spouseFamilies`, `siblings`, and `mainParents === null`; I2's siblings are `[I9]` (I2 excluded); F1's marriage (both spouses deceased) is present on I2's spouse family, and F3's (living I1 and I14) is absent on I1's; `getTreeView('I2')` has parents I4 and I5, grandparents I6 and I7 under I4, and `hasMoreAncestors` is false on I6, I7, and false on I5; `getTreeView('I2', 1)` returns parents I4 and I5 with `hasMoreAncestors` true on I4 (his parents exist) and false on I5; a self-referencing family (person is their own parent) terminates; `getFamilyView('NOPE')` is `undefined`.
- [ ] **Step 2: Run**; expect FAIL.
- [ ] **Step 3: Implement.** Resolve people with `Promise.all`; the main parent family is `childOfFamilies[0]`; tree recursion stops at `up` and when an id has already been visited.
- [ ] **Step 4: Run**; expect PASS.
- [ ] **Step 5: Commit** `git commit -am "feat: family view and tree model"`.

### Task 8: App shell, routing, home and surname pages

**Files:**
- Create: `src/lib/route.ts`, `src/lib/format.ts`, `src/styles/tokens.css`, `src/main.tsx`, `src/App.tsx`, `src/components/Layout.tsx`, `SearchBox.tsx`, `PersonLink.tsx`, `src/pages/Home.tsx`, `SurnamePage.tsx`, `NotFound.tsx`
- Test: `tests/route.test.ts`, `tests/home.test.tsx`

**Interfaces:**
- Produces: `Route = {name:'home'} | {name:'person'; id: string} | {name:'tree'; id: string} | {name:'surname'; surname: string} | {name:'notfound'}`; `parseHash(hash: string): Route`; `hrefFor(route: Route): string` (e.g. `#/person/I4`); `yearsOf(p: PublicPerson): {birthYear: number | null; deathYear: number | null}`; `lifespan(birthYear: number | null, deathYear: number | null, living: boolean): string` (`'1870 – 1931'`, `''` for living); `<PersonLink id={string} name={string} birthYear?={number|null} deathYear?={number|null} living?={boolean}/>` renders the name as `<a href="#/person/ID">`, with the lifespan unless living, and a muted "Living person" note for living people.
- Layout follows the Home and Search mockup: header with site name, search input (visible label via `aria-label`), results list under the input, surname chips with counts from `manifest.topSurnames`, and the total counts line from the manifest.

- [ ] **Step 1: Write failing tests:** `parseHash('')` and `'#/'` give home; `'#/person/I4'`, `'#/tree/I4'`, `'#/surname/Bryan'`; `'#/surname/O%27Brien'` decodes to `O'Brien`; `'#/nonsense'` and `'#/person/'` give `notfound`. Home test (mock `./data/api`): typing "hay" shows results from `searchPeople` as links; a living result shows its name and "Living person" with no years; surname chips link to `#/surname/Bryan`.
- [ ] **Step 2: Run**; expect FAIL.
- [ ] **Step 3: Implement.** The router listens to `hashchange`. Define the color tokens from Global Constraints once in `tokens.css`, with the dark values under `prefers-color-scheme: dark`. The surname page loads `loadShard(shardKey(surname))`, keeps entries whose name ends with the surname (case-insensitive), and sorts by name.
- [ ] **Step 4: Run**; expect PASS. Then `npm run dev` and check the home page at 400px width.
- [ ] **Step 5: Commit** `git commit -am "feat: app shell, routing, home and surname pages"`.

### Task 9: Person page

**Files:**
- Create: `src/pages/PersonPage.tsx`, `src/components/Timeline.tsx`, `src/components/FamilyBox.tsx`; Modify: `src/lib/format.ts`
- Test: `tests/format.test.ts`, `tests/person-page.test.tsx`

**Interfaces:**
- Consumes: `getFamilyView`, `PersonLink`, `lifespan`.
- Produces: `buildTimeline(person: PublicPerson): {year?: number; title: string; detail?: string}[]` (sorted by year, events without a year last; titles: BIRT "Born", DEAT "Died", BURI "Buried", RESI "Lived in {place}", others use the event `label`; `detail` is the place for Born/Died/Buried, and for RESI an extracted `Occupation: X` when the event `value` has one, otherwise none; the raw census `value` string is never shown).

- [ ] **Step 1: Write failing tests:** `buildTimeline` on Oliver gives one 1910 entry; entries are sorted; a RESI with value containing `Occupation: Masseur` has detail `Occupation: Masseur`; a RESI with a long census value and no occupation has no detail. Page tests (mock api): deceased person shows heading, lifespan, timeline, and a Family box with parents (up arrow), spouse, children (down arrow), all as `#/person/ID` links; a person with `otherParentFamilies` shows "Also listed as a child of"; a living person's page shows the name and a "Living person. Details are hidden." note and no timeline and no Family-box dates; a deceased person's living spouse appears as name only; siblings are listed; unknown id renders NotFound; a person with no families shows no empty Family headings; the page has a "See in the family tree" link to `#/tree/ID`.
- [ ] **Step 2: Run**; expect FAIL.
- [ ] **Step 3: Implement** to the Person page mockup (hero with name and lifespan, two columns: timeline left, Family box right, stacking at phone width).
- [ ] **Step 4: Run**; expect PASS.
- [ ] **Step 5: Commit** `git commit -am "feat: person page with timeline and family box"`.

### Task 10: Tree page

**Files:**
- Create: `src/pages/TreePage.tsx`, `src/components/TreeCard.tsx`
- Test: `tests/tree-page.test.tsx`

**Interfaces:**
- Consumes: `getTreeView`, `TreeNode`, `TreeView`, `hrefFor`.

- [ ] **Step 1: Write failing tests (mock api):** for I2 the page shows columns Grandparents, Parents, Selected person, Children; cards link to `#/tree/ID` (clicking re-centers) and a "Details" link to `#/person/ID`; a card with `hasMoreAncestors` shows an up/left arrow control; living children render as name-only cards with no years; unknown id renders NotFound; a person with no parents shows the selected card and children without empty columns.
- [ ] **Step 2: Run**; expect FAIL.
- [ ] **Step 3: Implement** to the Walking-the-tree mockup. Below 700px width the columns stack vertically (parents above, children below) rather than scroll sideways.
- [ ] **Step 4: Run**; expect PASS.
- [ ] **Step 5: Commit** `git commit -am "feat: tree page"`.

### Task 11: Privacy verification and deploy

**Files:**
- Create: `scripts/lib/privacy.ts`, `scripts/verify-privacy.ts`, `README.md` (update routine)
- Test: `tests/privacy.test.ts`

**Interfaces:**
- Consumes: `isLiving`, `RawFile`.
- Produces: `collectSensitiveStrings(raw: RawFile, overrides: Overrides): string[]` (for each living person: each event's place and date, the occupation, and `value`; birth year strings are not included); `findLeaks(sensitive: string[], dirs: string[]): {file: string; match: string}[]` scanning every file under the directories. CLI: `npm run verify:privacy -- <raw json path>` checks `dist/` and `public/data/`, prints leaks, exits 1 if any.

- [ ] **Step 1: Write failing tests** on the fixture: sensitive strings include `Scranton PA`, `English Village`, `Palmyra PA`; `findLeaks` finds a planted file containing `English Village` in a temp dir; reports none on output of `buildData(sanitize(fixture))` written to a temp dir; a place shared with a deceased person is not flagged when it appears only in the deceased person's data (exclude strings that also occur in any deceased person's events).
- [ ] **Step 2: Run**; expect FAIL.
- [ ] **Step 3: Implement.** `README.md` documents: export from FTM, `npm run sanitize -- <raw path>`, review the printed 1926–1940 list and `data/overrides.json`, `npm run verify:privacy -- <raw path>` after `npm run build:data && npm run build`, commit `data/family.public.json`, push (Amplify rebuilds). It also notes that the raw file must stay under `data/raw/`.
- [ ] **Step 4: Run** `npx vitest run`; expect all PASS.
- [ ] **Step 5: End-to-end on the author's real file** (on the author's computer): sanitize the real export, then `npm run build:data` (expect no file over about 300 KB and under about 700 total files), `npm run build`, `npm run verify:privacy -- <raw path>` (expect no leaks), then `npm run dev` and open `#/person/I4` and `#/tree/I2`.
- [ ] **Step 6: Commit and push** `git add -A && git commit -m "feat: privacy verification, README, deploy config" && git push`; confirm the Amplify build passes and the deployed site loads `#/person/I4`.
