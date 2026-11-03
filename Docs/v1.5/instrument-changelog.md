# v1.5 instrument changelog

The full history of `INSTRUMENT_ID` up to v1.5.9 is the doc comment of `src/v15-instrument/rule-set.ts`. Entries from
v1.5.10 on are also kept here.

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
