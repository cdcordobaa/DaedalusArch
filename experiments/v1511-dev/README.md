# V1511-DEV: v1.5.11 fixes from the HCAL-08 hand read (2026-11-04)

Exploratory instrument work. No model calls, no Neo4j. **This is a development fit.** HCAL-08 was scored once at
v1.5.10 (`Docs/DiagnosticRuns/v15-hcal08-admission-2026-11-03.md`) and is now development material: its cases were
opened and shaped these fixes, so the HCAL-08 numbers below are not admission evidence. A fix counts only after a
fresh blind admission. HCAL-07, the sealed and held-out sets and the MEAN-01 sample were not read.

`INSTRUMENT_ID` is now `v1.5.11`. The counted lists are unchanged: `HX_COUNTED_RULES`, `HX_MIRROR2_SHAPES` and the
`rule-set.ts` rows and admitted rows. No registered study was rescored, and no opt-in flag was needed (see
"Regression").

## Fixes

| # | Where | Change | Status |
|---|---|---|---|
| 1 | `graph.ts` (`projectResolution`, `writeTsconfig`), `facts.ts` (`externalModuleOf`) | The harness tsconfig takes the tree's own `baseUrl` and `paths`, read through TypeScript (so `extends` and comments are handled), with every `paths` target made absolute. Nothing else of the project's tsconfig is taken. A tree with no tsconfig, or one that sets neither option, gets the earlier tsconfig byte for byte. A declaration file reached through an exact `paths` entry is named by that entry's specifier (else by a `package.json` beside it), as the CN-05 fallback named it before | done |
| 2 | `facts.ts` (`appVendor`), `graph.ts`, `rules/r-appvendor-application-imports-vendor.cypher`, `rule-messages.ts` | New rule **R-APPVENDOR** (exploratory, on no row, not delivered, as R-INBYP in PR 476): a file of role application or port names, in any module edge, a package that an adapter file of the same tree imports. Edges: import declarations (type-only and inline `type` included), `export … from`, `import x = require(…)`, dynamic `import('…')`, `import('…').X` types. Read from the specifier text, so it does not need the package to resolve. Relative, `node:` and own-code (`paths` into the tree) specifiers are not packages. Domain files are left to FF-P01 | done |
| 3 | `facts.ts` (`pkgOf`) | A pure barrel (every statement an `export … from`) directly in a folder of adapters (`src/adapters/out/index.ts`) has no adapter package of its own. Its re-exports are not adapter-to-adapter edges. An adapter that imports it reaches the declaring files (`via-barrel`), and those are judged as before | done |
| 4 | (none) | Vendor text that reaches the core through an inbound DTO typed `string` | **limit**, see below |

## Regression (zero calls)

`experiments/v158-dev/evaluate.ts` (every v1.5 rule, no judge) was run twice. *Before* is `main` `64b43fc31`
(v1.5.10, the code as merged). *After* is this branch. Each run covers the same 993 trees as PR 490: the 11 task seeds
and the final trees of the 220 kept Hexagonal study sessions (`origin/results/v15-hx-study`, commit `5f69990e4482`),
plus the 762 dev-set trees (HCAL-01..04, HCAL-06, hx-rules-v3-dev, h11d-dev, d5-unseen, CAL-01..03). The comparison
is `regression.ts`, and its output is `results/regression.json`.

- Every rule other than the new R-APPVENDOR gives **byte-identical** results on all 993 trees: the same sorted
  `rule|file|subject|evidence` lines, and one sha256 for both sides. That covers the HCAL-04, HCAL-06 and
  hx-rules-v3-dev bases, which carry tsconfig `paths`. The counts are 7 findings on the seeds, 433 on the 220 final
  trees and 482 on the dev sets.
- R-APPVENDOR fires on no seed and no kept study tree. It fires on 4 dev trees, and all 4 are labelled positives of
  another row: HCAL-02 `meters/H04-pos1` (`gridco-sdk` type in an out-port), `meters/H04-pos2` (`knex` type in an
  out-port) and `recruitment/H04-pos1` (`checkr-sdk` in an out-port), and CAL-01 `events/K13-pos1` (`stripe` type in
  an application gateway interface).

Scorers (`experiments/cal-01/score.ts`, no judge) were run on `main` from a frozen copy of `src/` and on this branch.
The sets were CAL-01..03, HCAL-01..06 (`--rows hex`) and HCAL-08 from its scoring copy (`--rows hcal08`). The
comparison is `compare-scores.py`, and its output is `results/scorers.json`. Every case of every set, before HCAL-08,
has the same pass and the same hits, R-APPVENDOR aside. In HCAL-08 one case changes: glacier `EDGE-twin1` passes now
(fix 3).

Unit tests: `tests/unit/v15-instrument/v1511-hcal08-fixes.test.ts`.

## HCAL-08 rows, before and after (development numbers, not blind)

| Row | v1.5.10 (as scored, `result.json`) | v1.5.11, row map as frozen | v1.5.11, R-APPVENDOR added to HX8-EDGE (dev reading) |
|---|---|---|---|
| HX8-WORD | 0/6, 0/6 | 0/6, 0/6 | — |
| HX8-SET | 6/6, 0/6 | 6/6, 0/6 | — |
| HX8-KEY | 0/6, 0/7 | 0/6, 0/7 (no judge asked) | — |
| HX8-EDGE | 6/11, 1/10 | 6/11, **0/10** | **11/11, 0/10** |

The cells read "positives caught, clean cases flagged". The v1.5.11 runs made no judge call, so R-MIRROR-SEM cannot
fire in them. Its zero-call candidate census (`results/census-*-v1.5.11.txt`) shows what the judge would now be asked:

- **HX8-KEY pos2** (form C): all three now form the expected candidate, with no copy to node_modules: glacier
  `outcomeOf:compare(state)` (4 of `PermitState`'s values), luthier `SURCHARGE_BY_GRADE` (4 of 4 `WoodGrade`) and
  orchard `payoutRateFor:switch(grade)` (3 of 3 `FruitGrade`). This matches the earlier node_modules probe line for
  line (`experiments/hcal-08/results/post-score-census-vendor-in-node-modules.txt`).
- **HX8-SET pos2**: candidates form as in that probe (glacier form C, luthier forms A and C, orchard form A).
- **pos1** (KEY and SET): still no candidate. This is the DTO limit below.
- **Twins**: one KEY twin forms an asked candidate, orchard `KEY-twin2` (`payoutRateFor:switch(grade)`, keys declared
  ours by the glossary). It is the twin that tests whether the judge reads the glossary. No other KEY or SET twin
  forms an asked candidate.

The R-APPVENDOR catches in HX8-EDGE are glacier `EDGE-pos2` (dynamic `import()`, line 23) and `EDGE-pos4` (line 1),
luthier `EDGE-pos2` (inline `type` import, line 1), and orchard `EDGE-pos1` (`export … from`, line 5) and `EDGE-pos2`
(`import = require()`, line 1). Each hit is on the labelled line. It fires on no base and no EDGE twin.

## Limits

- **Fix 4, not done.** In the KEY-pos1 and SET-pos1 cases, the vendor's value reaches the core through the webhook's
  own DTO (`BulletinDto.band: string`, a structural copy of the vendor's `HazardBulletin` with the value fields
  widened to `string`). The core is reached through the inbound port's command. Tracing that needs a new fact: an
  in-tree DTO that structurally mirrors a vendor type would stand for that type, and its `string` fields would carry
  the vendor's value sets. That is a name-matching heuristic inside R-MIRROR-SEM's candidate step. It would change the
  candidate census, and with it the judge questions, on HCAL-06 and the SEM gates. It is not a small fact fix, so it
  is left as a limit.
- R-APPVENDOR reads a package as the vendor only when some adapter of the same tree imports it. An application file
  that imports a vendor package that no adapter wraps is not reported here (R-COREIO still reads catalogued I/O
  packages). A utility library that both an adapter and the application import (a validation library, say) would be
  reported. None of the 993 trees has one.
- One-word vendor field names (HX8-WORD field) remain out of `[word]` by design (PR 483, t09).
- R-APPVENDOR and the R-AXA barrel change were developed on the HCAL-08 cases they fix. Their recall and false-flag
  rate need a fresh blind set.

## Files

`regression.ts` and `results/regression.json` (counted regression) · `compare-scores.py` and `results/scorers.json`
(scorer before/after) · `results/hcal08-dev-v1.5.11.json` (HCAL-08 scorer record at v1.5.11, no judge) ·
`results/census-pos2-v1.5.11.txt`, `results/census-key-set-v1.5.11.txt` (zero-call candidate census).
