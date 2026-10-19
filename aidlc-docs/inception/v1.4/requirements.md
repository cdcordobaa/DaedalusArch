# v1.4 Instrument-Alignment: Requirements (minimal depth)

**Cycle:** AI-DLC v1.4, "instrument alignment". **Started:** 2026-10-18. **Depth:** minimal. The request is clear and the design work already exists in `ops/`, so this page records intent and traceability. It does not restate the design.

## 1. Intent

Build what is still missing so that the built instrument matches the agreed instrument map. Then freeze it, run the whole-instrument checks once, and run Study 2 once.

The sources of truth are linked here, not copied:

| Source | What it settles |
|---|---|
| [`ops/01-instrument-map.md`](../../../ops/01-instrument-map.md) (v3) | the four planes, ten parts (C1a to C6, C3m), artifacts A1 to A6 and their contracts |
| [`ops/03-build-list.md`](../../../ops/03-build-list.md) | what is still to build, per part, with "done when" |
| [`ops/04-north-star.md`](../../../ops/04-north-star.md) | the per-part test and the whole-instrument measure behind each objective SO1 to SO5 |
| [`ops/decisions.md`](../../../ops/decisions.md) | settled board decisions (D5, N3, M3, M4, M5, M6, CDX, N1, N4, D2b and others) and the items still open (L4, D1, NS01) |

**Precedence.** Where the map's §8 cut list and `ops/decisions.md` disagree (the map cuts Q26 and the DDD cycle rule; decisions D5 and N3 add them), the later board decisions win.

**Classification.** Brownfield, multiple components, moderate complexity. Reverse engineering artifacts exist and are not refreshed.

## 2. Functional requirements

One requirement per build-list item that is code. Items that are documents only (C1c tool counts, D2b construct limit) and items out of scope (C2 mined, C2r) have no FR.

| FR | Build-list item | Part | Decision | Done when (from the build list) | Unit |
|---|---|---|---|---|---|
| FR-1 | Fix the `paths` alias gap (N33) and optional constructor parameters (N38) in the extractor | C1a/b | D6 | tsc parity still holds; the N38 seeds are detected | U1 (own PR) |
| FR-2 | DDD dependency-cycle rule, declared post-seal, with ADR and tests | C2 declared | D5 | rule green in CI and declared as a deviation | U2 |
| FR-3 | Application purity rule (Q26), declared post-seal, with ADR and tests; the 12 framework-leak seeds become rule hits | C2 declared | N3 | rule green in CI and declared as a deviation | U2 |
| FR-4 | Semantic layer writes facts into the A2 facts file through the query layer (C1c), per the contract in `ops/notes/ns-02-facts-contract-and-cases.md` | C1d | N1, M4 | facts saved with source, model id, prompt hash, date, confidence | U3 |
| FR-5 | One-context fragmentation change (case-05 needs it) | C1d | N4 | case-05 runs on the mock provider | U3 |
| FR-6 | Vendor-neutral model route with a Gemini adapter, tested on mocks only | C1d | CDX, map risk 4 | adapter passes contract tests against a recorded or scripted response | U3 |
| FR-7 | Replace case-06 with a true K3 case and its twin | C1d | N2 | cheap proxies do not catch the new case; answers committed first | U3 |
| FR-8 | Violation identity across commits as a reusable module (renames, deletions, cycles) | C1e | (G08 proposal) | fix mining, drift and Study 2 scoring can call it | U4 |
| FR-9 | Drift metric D computed from snapshots, using FR-8 | C5 | M3 | runs on recorded agent sessions and on human histories; reproduces the fix-mining survival table | U4 |
| FR-10 | Evasion check for Study 2 | C6 | M6 | runs on a dry run | U5 |
| FR-11 | Gemini generator adapter for the Study 2 harness | C6 | CDX | works on a dry run, no live call | U5 |
| FR-12 | Detection recall fixes Q5 D, Q6 B, Q10 C, Q12 B: options and ADR drafts tied to the 9 spec-manifest disagreements | C3 | (author adjudication pending) | design only until the author adjudicates the 9 rows | U6 |
| FR-13 | Meaning analysis script: κ and meaningful precision with intervals | C3m | D3, L4 (open) | script runs on a synthetic answer sheet; no real labels needed | U7 |
| FR-14 | Efficiency test harness: driver and scorer, graph tools vs raw files | C1c efficiency | M5 | scorer runs on committed answers in `experiments/eff-01/`; driver runs in dry-run mode | U8 |

## 3. Non-functional requirements

| NFR | Requirement |
|---|---|
| NFR-1 Machine limits | At most 2 build lanes at once. `jest --maxWorkers=2`. Never start Neo4j: tests use the in-process Cypher interpreter (`src/cypher-interp`), or are skipped with a note. |
| NFR-2 Reproducibility | Every saved neural artifact (A2 facts, A5 verdicts, generator outputs) carries the model id and the prompt hash, plus the date. Results are replayed, not regenerated. |
| NFR-3 No model calls in construction | Construction uses mock, scripted or dry-run providers only. Any live call (C1d pilot, efficiency test, Study 2) needs a counted note and the author's OK, and happens after the freeze. |
| NFR-4 Reference stability | New behaviour is off by default; reference results stay byte-identical unless a declared deviation says otherwise. |
| NFR-5 Public repo | Repo-relative paths only. No credentials, no billing figures, no sealed material (`daedalus-sealed/` is never read). |
| NFR-6 Approval | Each unit ends in a PR that is not merged. The author's PR review is the code-approval gate. |

## 4. Extension compliance

| Extension | Status | Note |
|---|---|---|
| Security Baseline | Enabled (from v1.2E) | Applies to FR-6 and FR-11: keys only from the environment, never logged or committed; adapters are mock-tested. Other FRs are offline analysis code: N/A beyond NFR-5. |

## 5. Open items that gate parts of this cycle

- **L4** (meaningful finding definition) gates the real use of FR-13, not its construction.
- **The 9 disagreement rows** gate FR-12 beyond design.
- **NS01** (author reads NS-01) gates the C1d pilot, not FR-4 to FR-7.
- **D1** changes may alter any of the above.
