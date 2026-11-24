# Bryan Family Tree

A static family-tree website (Vite, TypeScript, React) built from genealogy research exported from Family Tree Maker. It is hosted on AWS Amplify, and the repository is public, so only sanitized data is ever committed.

## Privacy: the living rule

A person is treated as living if their birth year is after 1940. If there is no birth event, the earliest baptism or christening year is used instead. Living people are published by name only. Their events, places, occupation and sex are removed.

Edge cases can be settled by hand in `data/overrides.json`, as `{"I123": "living" | "deceased"}`.

**The raw export must never be committed.** Keep it under `data/raw/`, which is git-ignored. If a raw export is ever committed, it stays in git history even after the file is deleted, so treat that as a data breach and rewrite history or recreate the repository.

## Updating the site

1. Export the tree from Family Tree Maker as JSON and put it under `data/raw/`.
2. Run `npm run sanitize -- data/raw/<file>.json`.
3. Review the printed lists: people born 1926-1940 with no death record, and people with no birth year but recent evidence. Add any needed entries to `data/overrides.json` and re-run step 2.
4. Run `npm run build:data && npm run build`.
5. Run `npm run verify:privacy -- data/raw/<file>.json`. It scans `dist/` and `public/data/` for any place, date, occupation or event text belonging to living people, and exits 1 if it finds any.
6. Commit `data/family.public.json` (and `data/overrides.json` if changed), then push. Amplify rebuilds and deploys.

## Development

`npm run dev` needs `public/data/`, so run `npm run build:data` first. Run tests with `npm test`. Node 22.12 or newer is required (see `.nvmrc`).

## How search works

Search matches the start of a first name or surname. Limits:

- Queries should start with a first name or surname.
- Middle names on their own are not indexed.
- Later words of multi-word surnames are not indexed.
