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
5. Run `npm run verify:privacy -- data/raw/<file>.json`. It scans `dist/` and `public/data/` for place, date, occupation or event text belonging to living people, and exits 1 if it finds any. Parsed `.json` files are compared value by value (exact string equality, also against the normalized and Unicode-NFC forms of each string). Other files (the JS and CSS bundles) are scanned for substrings, but only for strings of 6 or more characters that are not purely digits and punctuation. It also runs the structural check on `data/family.public.json` (the same check `npm run build:data` and `npm test` apply).

   Limitation: a string shared exactly with a deceased person (a common town, say) is skipped, or the check would flag every file. The tool prints how many strings were skipped. A living person's detail published under one of those shared strings would not be detected, so spot-check living people's pages by hand.
6. Commit `data/family.public.json` (and `data/overrides.json` if changed), then push. Amplify rebuilds and deploys.

## Development

`npm run dev` needs `public/data/`, so run `npm run build:data` first. Run tests with `npm test`. Node 22.12 or newer is required (see `.nvmrc`).

## How search works

Search matches the start of a first name or surname. Limits:

- Queries should start with a first name or surname.
- Middle names on their own are not indexed.
- Later words of multi-word surnames are not indexed.

## Hosting note

Do not add a catch-all rewrite rule (a 404 rewritten to `index.html`) to the Amplify app. Hash routes need none. The data client treats an HTML response with status 200 as a missing file, and search skips shards that are not listed in `manifest.json`, but a rewrite rule would still hide real errors.
