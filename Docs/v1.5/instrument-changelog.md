# v1.5 instrument changelog

The full history of `INSTRUMENT_ID` up to v1.5.9 is the doc comment of `src/v15-instrument/rule-set.ts`. Entries from
v1.5.10 on are also kept here.

## v1.5.11 (2026-11-04): fixes from the HCAL-08 hand read (exploratory, development data)

- **Why.** The HCAL-08 blind admission (`Docs/DiagnosticRuns/v15-hcal08-admission-2026-11-03.md`) traced its misses
  and its one false flag to three causes. (1) The harness tsconfig ignores the tree's `paths`, so a vendored SDK never
  resolves and R-MIRROR-SEM's vendor-text tracing finds nothing. (2) No rule reads an application-layer import of the
  vendor package. (3) R-AXA reads a barrel placed directly in `adapters/out` as a package of its own.
- **Change.** (1) `writeTsconfig` adds the tree's own `baseUrl` and `paths` (`projectResolution`, through TypeScript,
  targets absolute). A tree with no tsconfig, or one with neither option, gets the earlier tsconfig. A declaration
  reached through an exact `paths` entry is named by its specifier. (2) R-APPVENDOR: an application or port file
  imports, in any module edge, a package that an adapter of the tree imports. It is exploratory, on no row and not
  delivered. (3) A pure barrel directly in a folder of adapters has no adapter package.
- **Not done.** Vendor text carried by an inbound DTO typed `string` (KEY-pos1, SET-pos1) is still not traced. This
  is a limit (`experiments/v1511-dev/README.md`).
- **Regression.** Every rule except R-APPVENDOR is byte-identical on the 993 trees of PR 490 (11 seeds, 220 kept
  study trees, 762 dev-set trees). R-APPVENDOR fires on no study tree, and on 4 dev trees that are all labelled
  positives. The CAL-01..03 and HCAL-01..06 scorers give the same pass and hits for every case. No flag is needed.
- **HCAL-08, development numbers.** HX8-EDGE false flags drop from 1/10 to 0/10. With R-APPVENDOR added to the row,
  recall goes from 6/11 to 11/11. All three HX8-KEY pos2 cases now form their form-C candidate (the judge was not asked).
- No counted rule, row or list changes. No registered study is rescored.

## v1.5.10 (2026-11-03): R-MIRROR-SEM form C (exploratory, uncounted)

- **Why.** In the SEM-2 agent pilot (`Docs/DiagnosticRuns/v15-sem2-pilot-2026-11-02.md`) four sessions ended with an
  untyped core table keyed by the vendor's states and indexed with the port-carried vendor text (c005:
  `STAGES[s.stateCode]`). v1.5.9 made no candidate there: it counts a core-side pair only as a mapping into a declared
  core value set, the table's values are plain strings, and a table never fills itself.
- **Change** (`src/v15-instrument/mirror-sem.ts`, `keyLookupsOf`, `keyCandidatesOf`). A core lookup (object literal /
  `Record` / `as const` object, `new Map([...])`, switch, or equality chain) with at least 3 keys that name, by the
  existing normalisation, at least half of a vendor value set, and that vendor text from a port or the vendor typings
  consults, is a candidate whose core set is its key set (`coreKind: 'keys'`). Same question, schema, model and
  deferred mode; the form-C prompt differs only in its mapping heading. Every earlier candidate and question key is
  unchanged.
- **Gate.** SEM-GATE-3 (`experiments/sem-gate-3/`, criteria pushed before any judge call): PASS. Form A 11 / 11; fresh
  form C 6 / 6; dev (the pilot trees) 4 / 4; false positives 0 / 52; 0 citation problems; deferred hub p95 289 ms; 25
  model calls.
- **Regression.** Counted findings byte-identical on the 220 kept Hexagonal study trees and the 762 dev-set trees
  (`experiments/sem-gate-3/results/regression.json`); no kept study tree gains an R-MIRROR-SEM candidate.
- No counted rule, row or list changes; no registered study is rescored.
