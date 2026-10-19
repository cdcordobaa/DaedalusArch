# NS-02 K3/K2m case set (Ontology v0 convention)

Six defect cases, each with a twin that should pass. Contract, rules, expected facts and run specs:
`ops/notes/ns-02-facts-contract-and-cases.md`. Every `expected-semantic.json` here was written on 2026-10-18,
before any model run, prompt change or pipeline change on these cases.

| Pair | Defect case | Twin (should pass) | Level | Where |
|---|---|---|---|---|
| 1 | `ns02/case-05-fragmentation-in-context` | `ns02/case-05t-control-contexts-own-models` | K3 + K4 | here |
| 2 | `ns02/case-09-limit-only-in-controller` | `ns02/case-09t-control-length-check-in-controller` | K3 | here |
| 3 | `ns02/case-07-policy-in-repository` | `ns02/case-07t-control-specification-in-domain` | K3 | here |
| 4 | `case-02-misplaced-pricing` | `case-04b-control-clean-notification` | K3 | parent dir (unchanged) |
| 5 | `case-01-rule-dup-shapes` | `case-04a-control-near-miss-rules` | K2m | parent dir (unchanged) |
| 6 | `ns02/case-08-refund-window-shapes` | `ns02/case-08t-control-same-window-different-rules` | K2m | here |

- Same layout as the parent set (`src/`, `tsconfig.json`, `expected-semantic.json`). In addition, each case has its own
  `layers.json`, which declares the DDD bounded contexts (`ddd.contexts`). Run each case with
  `--project <dir> --layers <dir>/layers.json`.
- The manifests keep the scorer's `expect` and `forbid` blocks. The `ns02` block adds `expectedFacts` (A2 facts, with
  polarity `required`, `forbidden` or `tolerated`) and `expectedVerdicts` (the C3 rules SEM-MISPLACED, SEM-DUP and
  SEM-FRAG). The current scorer reads only `expect` and `forbid`.
- `case-05` replaces the parent `case-03-concept-fragmentation` for the NS run (decision N4: fragmentation only counts
  inside one declared context). `case-03` and `case-04c` stay unchanged, because the mock regression tests use them.
- **Retired 2026-10-18 (v1.4 U3):** `case-06` / `case-06t`. The cheap role proxy separates the pair (NS-01 §7
  falsifier 1), so it cannot carry the "a model is needed" claim. Both stay on disk unchanged as the recorded evidence.
  Pair 2 is now `case-09` / `case-09t`: the two cases are byte-identical except the controller's guard line, its
  constant and its error text (a purchase limit vs a gift-note length check), carry no explanatory comment, and every
  cheap proxy gives the same output on both (zero-call dry run, recorded in the manifests' `cheapExpectation`).
- `set.json` is the set index: the six pairs with their directories, `layers.json` and `ns02` blocks, and the retired
  pair. The four parent cases' `ns02` blocks are sidecar files in `parent-blocks/`, written from each parent manifest's
  own `expect` / `forbid` items; the parent manifests are not edited (`set.json` records their SHA-256).
  `--ns02` runs the 12 projects of `set.json`.
- This directory has no mock answers and no cassettes. `--fixtures` does not read it, so the parent set's commands and
  tests are unchanged.
