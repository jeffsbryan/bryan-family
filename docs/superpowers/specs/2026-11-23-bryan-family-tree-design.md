# Bryan Family Tree: Design

Date: 2026-11-23. Status: draft for approval.

## Intent and why

A private-feeling but publicly hosted website for members of the Bryan family who want to learn about their ancestors. The source of truth is a genealogy file exported from Family Tree Maker (FTM) as JSON. Relatives should be able to search for a person by name and move through the tree by clicking: up to parents, across to spouses, down to children. The goal behind the features is "tell me about this ancestor"; the tree is the way to get there.

Visitors are relatives, many of whom have never used a family-tree tool. It must be usable on a phone with no instructions. Treat it as a keepsake more than a research tool.

## Source data (as inspected)

File: `Bryan_2013-11-18_2026-11-12.json`, about 27 MB, format `gedfile.com/json/v1`, exported by FTM from GEDCOM 5.5.1.

- `individuals`: 27,981 records. Fields: `id` (e.g. `I1`), `name`, `givenName`, `surname`, `sex`, `events[]`, `childOfFamilies[]`, `spouseOfFamilies[]`, and `occupation` on 278 people.
- `families`: 12,510 records. Fields: `id` (e.g. `F1`), `husband`, `wife` (either may be absent), `children[]`, `marriage` (6,083 have one), `divorce` (64).
- Event types and counts: BIRT 26,575; DEAT 23,868; RESI 20,133; BAPM 7,932; BURI 7,288; CHR 1,688; IMMI 105; EMIG 24; NATU 9; CENS 3. Events carry `label`, `date`, `year`, `month`, `day`, `place`, and sometimes `value` (census detail such as occupation, relation to head, marital status).
- Roughly 99% of people sit in one connected group (largest group 27,748 of 27,981; 116 groups total).
- 2,287 people belong to more than one parent family (adoption, step-parent, or disputed parentage). 3,303 people have more than one spouse family.
- 3,657 people have no birth year. There are no notes and no media links in the file.
- Names and places are free text and inconsistent (for example "Philadelphia PA" and "Atlantic City, Atlantic, New Jersey, United States").

## Goals

- Search by name; results show enough (years, place) to tell namesakes apart.
- Person page first. Each person has a page with a life timeline and a Family box linking to parents, spouses, children, and siblings.
- A tree view, one click from the person page, showing grandparents and parents to the left, the selected person in the middle, and children to the right, with arrows where more people continue.
- Photos and documents per person (multiple: yearbook, census image, marriage certificate, and so on), each with a caption and a type. Added after the first release.
- Updating is a repeatable routine: export new JSON from FTM, replace the file in the repo, push, the site rebuilds.

## Non-goals

- No logins, accounts, or user-submitted content.
- No editing of data on the site. FTM stays the place where data is changed.
- No stories or biographies in the first release. The author may add them later; leave room, do not build for it now.
- No photos in the first release (see Photos).

## Anti-goals

- A living person's details must never reach the browser. Hiding them with CSS or in the page is a failure; the data must not be in any published file.
- The raw export must never be committed to the public repo. If it was ever committed before, it remains in git history and the builder must tell the author to check and clean that.
- Do not ship the 27 MB file, or anything close to it, to a visitor's phone.
- Do not present a messy case (multiple parent families, missing parents or birth years) as if it were clean data, and do not crash on it.

## Constraints

- Static site only: no server, no database.
- Built and hosted with AWS Amplify Hosting, using an existing GitHub repo. Local project folder (on the author's computer): `/Users/jeffbryan/Projects/workspace/bryan-family/bryan-family`. The builder has not seen the repo, so existing files must be inspected first and respected.
- Works at phone width, light and dark.

## Approaches considered

- **A. Pre-built page per person.** A script generates about 28,000 HTML pages. Pros: real links that open fast and show link previews, works without JavaScript. Cons: file counts cause trouble on some free hosts (Cloudflare Pages caps at 20,000); photos add more files.
- **B. One app page that loads people on demand.** A build script splits the data into a few hundred bucket files plus a search index; the page fetches only what it needs. Pros: few files, any host works, tree-walking is instant. Cons: links are hash links; shared links show only the site title in previews; requires JavaScript.
- **C. Load the whole file in the browser.** Simplest, but too heavy for phones. Dropped.

Chosen: **B**, by the author. Reason: file count matters most once photos arrive, and B keeps every host available.

## Decisions made with the author

- Person page first, with the tree view one click away.
- Hash-based links, for example `/#/person/I4`.
- Living people: **anyone with a recorded birth year after 1940 is treated as living**, whether or not a death or burial record exists. Their name is shown; every other detail is hidden (dates, places, events, photos, family members' dates). They still appear in family lists, in search results, and in the tree, as "Living person" with the name. Currently 87 people match, 34 of whom have a death or burial record.
- Multiple photos per person, each with caption and type. A small list ties each image file to a person ID.
- Stack: Vite, TypeScript, React.
- **The GitHub repo is public.** The raw FTM export contains living people's details, so it is never committed. Update routine: (1) export JSON from FTM, (2) run a local script on the author's computer (`npm run sanitize -- <path to raw file>`) that applies the living rule and writes `data/family.public.json`, with living people reduced to id, name, sex and family links, (3) commit and push that file, (4) Amplify builds from it. The raw export path is listed in `.gitignore`.
- Amplify build runs the bucket and search-index preparation from `data/family.public.json`, then the site build. It never sees the raw file.
- Photos are excluded from the first release.

## My calls (author has not confirmed)

- People with no birth year are shown normally, not hidden.
- An override list in the repo (person ID to "living" or "deceased") lets the author correct the rule for individuals. For someone born after 1940 and known deceased, "deceased" reveals them.
- Living people appear in search by name only.
- The cutoff year (1940) is one configurable value, not scattered through code.
- The rule is applied exactly as the author stated it. Someone born in or before 1940 with no death record (for example born 1938, possibly alive) is shown in full. The author can add such people to the override list. The builder should print a count of people born 1926 to 1940 with no death record when sanitizing, so the author can review them.
- Home page: search box plus surname chips with counts, as in the mockup. No featured starting person.
- Add `noindex` so search engines skip the site. No password, since the author wants relatives to open it easily.
- Tree view shows 2 generations up (grandparents) and 1 generation down by default, expandable by clicking.
- When a person has more than one parent family, show the first as the main one and list the others as "Also listed as a child of...".

## Visual direction (from mockups reviewed with the author)

Calm, readable, family-album tone. Serif display for names (Newsreader), Inter for text, deep teal accent on a pale green-grey ground, white cards. Mockups: person page, tree view, home and search, published as a Design canvas "Bryan Family Tree Mockups" at https://claude.ai/artifact/DnNUgwe5HDeqyHrcU4NpAz (private to the author; the builder works from these layouts, and the author can export or share them). The mockup shows living people as "Living person, details hidden"; the decision above overrides that: the name is shown and the rest hidden.

## Parts the builder owns

- Two scripts. A local sanitize script (living rule, overrides, count report) writes `data/family.public.json`. A build script reads that, normalizes place text for display, builds the search index (names, with years for disambiguation), and writes bucket files by person ID and a manifest. A test must prove no living person's date, place or event appears in any output file.
- Bucket sizing and the search index format and loading strategy (it must stay small on a phone; consider prefix-based loading).
- Routing, page and component structure, accessibility, tests for the living rule and the data shaping.
- Amplify configuration (`amplify.yml`), including the rebuild path.
- Shape of the photo list and the gallery component, to be added later.

## Open for later

- How to export photos from FTM and the format of the person-to-image list.
- Stories or notes per person.
- Which host rules or cost limits matter once photos exist.
