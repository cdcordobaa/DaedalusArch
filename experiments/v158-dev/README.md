# V158-DEV: v1.5.8 fact fixes, development regression (2026-11-02)

Exploratory instrument work. No model calls, no Neo4j. **This is a development fit.** Every set below has already been
read, and two fixes were tuned on it, so these numbers are not admission evidence. A fix counts only after a fresh
blind admission. HCAL-07, the sealed and held-out sets and the MEAN-01 sample were not read.

The work comes from the v1.5 rule review (`Docs/DiagnosticRuns/v15-rule-review-2026-11-02.md`, findings #3, #5, #8
and #17) and the Hexagonal hand read (`Docs/DiagnosticRuns/v15-hx-study-2026-11-02.md` §3, t03/t09). `INSTRUMENT_ID`
is now `v1.5.8`. The counted lists are unchanged: `HX_COUNTED_RULES`, `HX_MIRROR2_SHAPES` and the `rule-set.ts`
rows and admitted rows. No registered study was rescored.

## Fixes

| # | Rule(s) | Change (facts unless noted) | Status |
|---|---|---|---|
| 3 | R-AXA, R-ENTITY-OUT | When the spec declares the file's adapter layer (kind presentation, infrastructure or adapter), the adapter package comes from that layer. The folder regex is the fallback. A folder of adapters (`adapters`, `adapters/<side>`, `infrastructure`, `infra`) keeps one package per sub-folder, as the regex reads it. A file directly in that folder belongs to the folder (`src/adapters/Flat.ts` → `src/adapters`). Any other adapter layer is one package (`src/http/**` → `src/http`). R-ENTITY-OUT also reads a declared presentation layer when the spec declares both a presentation and an infrastructure layer. New: `DetectSpec.adapterLayerOf` (`spec.ts`) | done |
| 5 | R-AXA | Module edges are now `import` declarations, `export … from`, `import x = require(…)`, dynamic `import('…')` with a literal, and a name imported through an in-tree barrel that is not another adapter's file. The shared-helper test reads every module edge, so a shared file that re-exports another adapter no longer counts as a helper | done |
| 8 | R-COREIO, R-PURE | An import whose named bindings all carry the inline `type` modifier is type-only. `import x = require('…')` is read. New catalogue entries (`ioCategoryOf`): postgres, kysely, `@supabase/*`, pg-promise, slonik, mariadb, mssql, tedious, oracledb, Neon, PlanetScale, libsql, `@vercel/postgres`, cassandra, neo4j-driver, elasticsearch, Upstash, objection, dynamoose; ky, ofetch, cross-fetch, isomorphic-fetch, needle, request, wretch, wreck; fs-extra, graceful-fs, fast-glob, glob; resend, postmark, mailgun-js. The shared `apg-enrich` classifier is not edited | done |
| 17 | R-D9 | `export * from` and `export * as ns from` in a published file expose every entity the target exports. The Cypher file is unchanged and stays byte-identical to the prototype | done |
| t03 | R-MIRROR2 | New shape `[word]` (Cypher and facts). A one-word vendor value counts only when all four hold: (1) it belongs to a *coded* vendor value set, meaning 2 or more members with at least one written as a code (`'accepted' \| 'insufficient_balance' \| 'voucher_blocked'`); (2) neither the spec nor the baseline core owns it; (3) in the core it is a member of a union, enum or constant set, and some core code compares, switches on or tests membership of the same word; (4) the core file is imported by an adapter that imports that vendor module | done |
| t09 | R-MIRROR2 | One-word vendor **field names** (`precision`) | **left out**: the reading fired on HCAL-04 `vet-clinic/H11-twin2`, a labelled clean twin that keeps the field name `precision` and translates its values. The t09 oracle counts that shape and the HCAL-04 labels do not. The two ground truths disagree, so no precise rule exists here |

`[word]` is not in `HX_MIRROR2_SHAPES.i` (`literal`, `error`), so it is not counted under option i. Option ii (`all`)
would count it.

## Development regression

`evaluate.ts` runs every v1.5 rule on the following trees. `compare.ts` diffs the before run (v1.5.7, `main`
1d815be7a, from a frozen copy of `src/`) against the after run (this branch). The diff is in `result.json`.

- **Hexagonal study kept trees** (`origin/results/v15-hx-study`): 220 counted sessions, extracted with `git archive`.
  Each task's seed runs once, and the final step of every session runs too. Each tree is scored with the task's spec
  and with the seed as `baseline`.
- **Dev sets**: every labelled case and base of HCAL-01, -02, -03, -04 and -06 (as used in `h06-adapter-rule-dev`
  and `h11d-dev`), h11d-dev, hx-rules-v3-dev, d5-unseen and CAL-01, -02, -03 (`r-d5s-dev`). That is 762 trees.

The table counts finding identities (`rule|file|subject`), summed over trees.

| Rule | Seeds (11) | `none` (110) | `combined` (110) | Dev sets (762 trees) |
|---|---|---|---|---|
| R-AXA, R-ENTITY-OUT, R-COREIO, R-PURE, R-D9 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| R-MIRROR2 | 0 / 0 | +9 / −0 (new vs seed 194 → 203) | +2 / −0 (new vs seed 0 → 2) | 0 / 0 |
| every other v1.5 rule | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |

Cells read added / removed. No evidence text changed either.

- All 11 additions are t03 (hxa3) `[word]` findings on the port union: `'accepted'` in 10 sessions and `'blocked'` in
  c220. All 11 sessions failed the t03 oracle. The two combined sessions are c184 and c220, the two "not seen" blocks
  of the §3 hand read.
- On the dev sets nothing moved, twins and clean cases included.
- The review fixes #3, #5, #8 and #17 change nothing on these trees. None of the trees has the shapes they add, so
  the new code is exercised only by the unit fixtures.
- **Disclosure (tuning on the study trees):** a first version of `[word]` counted the union alone. On the study trees
  it also fired on c057 and c130 (combined). In those sessions `'accepted'` sits in the port union, the core never
  decides on it, and the t03 oracle passed both. Condition (3) now also requires a core decision on the word. The
  t09 field-name reading added c015 plus five more t09 sessions, and the HCAL-04 twin above; it was dropped.

## Tests

`tests/unit/v15-instrument/v158-fact-fixes.test.ts`, with fixtures in `tests/fixtures/v158-facts/`: one standalone
tree (`hex-own-layers`), plus overlays on the f24, hxa3 and f14 seeds and on the CAL-03 drones base. They cover the
positives for every fix and the twins: a same-layer import, a same-folder flat import, a domain-only shared re-export,
a type-only DTO star re-export, a core set no vendor adapter imports, a comparison-only word, a union with no core
decision, and the left-out field name. The v1.5 instrument suite passes with `--maxWorkers=2`.

## Limits

- Development fit only. Admission needs a new blind, sealed set.
- An adapter layer whose glob puts `**` before its last folder names no folder, and falls back to the regex.
- `src/infrastructure/http` declared as an infrastructure layer is still not read as inbound.
- Dynamic `import()` with a non-literal argument is not an edge.
- `[word]` depends on the vendor set being coded. A vendor whose values are all plain words (`'paid' | 'failed'`)
  stays unseen, by design.

## Files

- `evaluate.ts`: all v1.5 rules on the study trees and the dev sets, written to a JSON file
- `compare.ts`: before/after diff per rule and bucket, written to `result.json`
- `result.json`: the diff above, with every added identity listed
