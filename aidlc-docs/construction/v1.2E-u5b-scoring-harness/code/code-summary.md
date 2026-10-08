# U5b Code Summary — Scoring and Harness

> **Cycle**: v1.2 Evaluation-Readiness (lane 4) · **Unit**: U5b (C15.3 matching rule and differential scorer, C15.4 re-scorer, C15.6 Gemini labeller, C15.7 run harness and aggregation, C15.8 corpus tools, C15.9 environment recorder) · **Date**: 2026-10-08
> **Branch**: `v1.2e-u5b-scoring-harness`, worktree `DaedalusArch-wt-u5b` · **Base**: `U5B_BASE` `76f04f4` (post-U3/U5a `origin/v1.2e`); `U5B_BASE2` `22a70b2` merged at Step 26 (U4, merge commit `5763124`)
> **Plan**: `aidlc-docs/construction/plans/v1.2E-u5b-scoring-harness-code-generation-plan.md` (ticked in the main checkout, D-U5b-1) · **Design**: `aidlc-docs/construction/v1.2E-u5b-scoring-harness/functional-design/`

U5b builds and tests the tools that turn CLI reports into thesis numbers. **It produces no thesis number**: no registered plan was run, `results/` does not exist, and no `RunRecord` of a registered plan exists. All U5b code lives outside `src/`. It reaches the CLI only as a subprocess and changed no golden snapshot (BR-U5b-74, 75).

## 1. Requirements delivered

| Requirement | Delivered by | Rules |
|---|---|---|
| FR-v1.2E-25 (+ ADR-017 item 6) | `Docs/matching-rule.md` 1.0.0 (final, registered); `scripts/score-golden.ts` (per instance, function, dimension, tag; baseline subtraction; count-once; failed-function runs rejected); hand-computed fixture committed before the scorer (`1fa0caf` precedes `28d1e26`) | BR-U5b-01..27 |
| FR-v1.2E-26 | `scripts/rescore.ts`: 3 dp reproduction of every AHS field, leave-one-dimension-out, sensitivity-only sweeps | BR-U5b-57..60 |
| FR-v1.2E-27 (+ ADR-017 item 7) | `scripts/llm-label.ts`, `scripts/lib/label-context.ts`, `Docs/labeller-prompts/*.md`: populations, two runs, reconciliation, root causes, Mock cassettes, blinded 30-item audit, three agreement comparisons plus judge reliability | BR-U5b-28..44 |
| FR-v1.2E-36 | `run-experiment.ts`, `aggregate.ts`, `select-corpus.ts`, `fetch-corpus.ts`, `prepare-bases.ts`, `record-env.ts`; acceptance, CSV set and figures, injected-failure rejection | BR-U5b-45..56, 61..68, 72, 76, 78 |
| FR-v1.2E-03 (feed) | `EnvironmentRecord` per plan run (`record-env.ts`) | BR-U5b-69 |
| NFR-v1.2E-05, 08 | Scrubbed cassettes, run and environment records (`scrubDeep`) | BR-U5b-70 |
| NFR-v1.2E-06 | `vega`, `vega-lite` as the only new devDependencies; lock committed; `npm ls canvas` empty | BR-U5b-71 |
| ADR-015 items 1, 2; ADR-017 item 4 | `corpus/frozen-instrument.json`; corpus-spec chain unchanged → fr22 → cv02 → remap; `corpus/prereg.json` v1 | BR-U5b-50..52, 77 |
| ADR-016 b, e; ADR-015 items 5, 10 | SP-* sensitivity probes in `function_sensitivity.csv`; latency gate function and `latency.csv` | BR-U5b-20, 49, 78 |
| NFR-01, FR-30 | No snapshot change, no `tests/golden/CHANGES.md` line | BR-U5b-74, 75 |

## 2. Exit table (U5bP §1.4)

| # | Criterion | Rule | Test | Commit |
|---|---|---|---|---|
| 1 | Hand-computed `GoldenScore` reproduced byte for byte (canonical form) | BR-U5b-26, 27 | `score-golden-acceptance.test.ts` (fixture `tests/fixtures/u5b/hand-computed/`; provenance test: fixture commit older than the first `score-golden.ts` commit) | fixture `1fa0caf`; acceptance `993fbde` |
| 2 | 3 dp re-scoring on five symbolic fixture reports and one recorded full-mode report | BR-U5b-58 | `rescore.test.ts` (five symbolic reports); `rescore-full-mode.test.ts` (replayed U4 Mock cassettes, `correct-reference`) | `78db180`, `f2bfab6` |
| 3 | Harness over the five fixtures: CSV set and one SVG; two injected failures `rejected` | BR-U5b-48, 72 | `aggregate.test.ts`, `run-experiment.test.ts` (fixture harness run, `tests/fixtures/u5b/injected/`) | `463c59c` |
| 4 | Labeller replays from committed Mock cassettes; agreement script runs; no live Gemini call | BR-U5b-36, 43, 44 | `llm-label.test.ts`, `label-audit.test.ts` (CLI end to end), `guards.test.ts` (no live `GeminiProvider` in tests) | `c225335`, `4a3cd09` |
| 5 | Pre-registration gate refuses a changed artefact or a registration not older than the first run | BR-U5b-50 | `prereg.test.ts` (both cases); scratch-clone check at Step 32 (one changed byte in `Docs/matching-rule.md` → `PREREG_REFUSED (artefact-changed)`, exit 1) | `a8c29f1`, `84bd30c` |
| 6 | A metric-only change produces no new key | BR-U5b-16 | `score-golden-rules.test.ts` | `984f4bc` |
| 7 | Full suite and C16 green; C16 unchanged | BR-U5b-74 | Gates U and G at every step; Step 33 values in §4 | every step |

BR-U5b-73 (`--self-test` exits 1 for every U5b CLI): 11 / 11 CLIs exit 1 (`score-golden`, `rescore`, `llm-label`, `run-experiment`, `aggregate`, `select-corpus`, `fetch-corpus`, `prepare-bases`, `record-env`, `export-frozen-instrument`, `remap-domain-layer`). Four of them had no `--self-test` until the Step 33 fix `dd7ed6c` (DV-U5b-27). BR-U5b-44 and 56 are checked in CI by `guards.test.ts` (no live Gemini provider in tests; nothing written under `results/`).

## 3. Files

### 3.1 Created (U5b-owned)
- **Scripts**: `scripts/{score-golden,rescore,llm-label,run-experiment,aggregate,select-corpus,fetch-corpus,prepare-bases,record-env,export-frozen-instrument,remap-domain-layer}.ts`, each with a `-cli.ts` entry; `scripts/lib/{report-io,stats,label-context,prereg,canonical-json,matching-rule,so5-codes,corpus}.ts`; `scripts/lib/schemas/{run-record,corpus,experiment-plan,prereg,environment-record}.schema.json`; `scripts/lib/figures/{ahs-by-project.vl.json,draw.ts,vega-lite-module.d.ts}`.
- **Documents**: `Docs/matching-rule.md` (1.0.0), `Docs/analysis-plan.md`, `Docs/corpus-criteria.md`, `Docs/labeller-prompts/{violation,judge-unit,missed-seed}.md`.
- **Corpus and registration**: `corpus/{corpus.json,candidates.json,selection.json,prereg.json,frozen-instrument.json}`, `corpus/overlays/<project>/*.patch` (5), `corpus/specs/{realworld-test,ghostfolio-test,truthy-demo,dry-run-test}.yaml`.
- **Registered plans**: `experiments/{fixtures,latency-gate,sensitivity,so4-heldout,e1-grid,e7-corpus}/plan.json`.
- **Tests and fixtures**: `tests/unit/scripts/u5b/**` (31 files incl. `guards.test.ts`, `self-test.test.ts`); `tests/fixtures/u5b/{hand-computed,reports,injected,cassettes,labels,plans,corpus-repo}/**`.

### 3.2 Modified (extended, not owned)
`package.json` (npm scripts, devDependencies `vega`, `vega-lite`), `package-lock.json`, `Docs/corpus.md` (edited-key record of the four spec commits). `tsconfig.scripts.json` and `jest.config.cjs` did not change: their globs already cover `scripts/**` and `tests/unit/scripts/**` (DV-U5b-2, 6).

### 3.3 Not touched (Step 33 allow-list)
`git diff --name-only origin/v1.2e...HEAD -- src schemas tests/golden fixtures/correct-reference 'fixtures/variant-*' specs presets results .github` prints nothing. No commit subject carries a `U<n>-K` label.

## 4. Gates at exit (Step 33, head `dd7ed6c` before this summary commit)

| Gate | Value | Reference |
|---|---|---|
| T | clean (`typecheck`, `typecheck:u0-tests`, `tsc -p tsconfig.scripts.json`) | clean |
| U | 2864 tests / 199 suites, 0 failed | 2822 / 194 at Step 26 + 42 U5b tests in Steps 27–33 (Steps 3–25 added 212 over the Step 2 value 2155) |
| L | 497 errors (`npm run lint`); every U5b script and test file 0 errors (D-U5a-8 form, 63 files) | 497 (Step 26) |
| B | 80, 0 `TS2688` | 80 (Step 26) |
| G | `GOLDEN_REQUIRED=1 npm run test:golden` exit 0, 80 tests / 7 suites, 0 skipped; three-dot and uncommitted `src tests/golden` diffs empty; snapshot hashes = `U5B_SNAPSHOT_HASHES` | `N_G` 80 (Step 26) |
| P | 0 / 0 at every commit | 0 |

**G0 statement**: U5b changed no file under `src/` or `tests/golden/`, regenerated no snapshot and wrote no `tests/golden/CHANGES.md` line. The five snapshot sha256 values are unchanged from Step 2: correct-reference `a9dbd9cc…a59efa43`, variant-a-structural `8836db1f…4ad956`, variant-b-pattern `61327e59…d0d8`, variant-c-everything `fbbdcbf5…1cc192`, variant-d-subtle `17a7b632…83d0b46b`.

## 5. Pre-registration and corpus-spec chain

- **Pre-registration v1**: commit `84bd30c`, committed 2026-10-08T20:03:37Z (`registeredAt` 2026-10-08T20:01:06Z). There are 28 artefacts, `matchingRuleVersion` 1.0.0 and `labellingBudgetCalls` 4000. `e1Grid` has 3 models, 3 levels, 2 tasks and 3 runs. `run-experiment-cli.ts --check-prereg experiments/fixtures/plan.json` still prints `pre-registration v1 ok: 28 registered artefacts unchanged` at Step 33.
- **Corpus-spec chain** (BR-U1-25, BR-U5b-77): unchanged `0c7b2df` → FR-22 `450134f` → FF-CV02 `194f7fe` → domain-layer remap `06ef4a7`.

## 6. Deviations (DV-U5b-1..29)

| # | Step | Deviation |
|---|---|---|
| 1 | 0 | `rev-parse = PLAN_SHA` is read as "`PLAN_SHA` is an ancestor of `origin/v1.2e`" |
| 2 | 1 | No separate scripts jest project; `tests/unit/scripts/**` runs under `jest.config.cjs` in `npm test` |
| 3 | 1 | `BaselineSelection` is a U4 type, checked at Step 26 |
| 4 | 2 | Lane Neo4j `daedalus-neo4j-u5b` on 7692 / 7478 instead of 7689 |
| 5 | 2 | Gate B scratch config in a lane subdirectory |
| 6 | 3 | `tsconfig.scripts.json` and the jest config are unchanged (globs cover U5b) |
| 7 | 5 | Import whitelist covers the consumed `src/` modules and type-only `src/shared/types/**` imports |
| 8 | 7 | Manifest `typecheck.tscPath` scrubbed (`[REDACTED]`) in the hand-computed fixture |
| 9 | 7 | Canonical `GoldenScore` adds `denominators` |
| 10 | 8 | Seed tags read from the report until the frozen-instrument export (closed at Step 13) |
| 11 | 11 | Re-scorer CSVs lead with `run_id`; ablation rows only for affected AHS fields |
| 12 | 11 | Definitions of the `any-fail` and `share` aggregation variants |
| 13 | 13 | The registry has 25 templates, not 24 |
| 14 | 14 | `ExperimentPlan` gains an optional `e1` block |
| 15 | 14 | Judge flags are passed only for judge modes |
| 16 | 16 | Per-function P/R rows use one cluster |
| 17 | 16 | Labeller-fed CSVs header-only until Group 7 (closed at Step 29) |
| 18 | 18 | Bare-repository test fixture built at test time |
| 19 | 19 | truthy-demo carries two extra overlays (`package-lock.json`, `.npmrc`) |
| 20 | 25 | Fix `bbf3d04`: `PreparedBase.overlays[].sha256` = the overlaid file content (OI-U5a-17) |
| 21 | 26 | Fix `8fe60a3`: tests read the fixture spec at the recorded commit after the U4 rubric edit |
| 22 | 28 | Missed-seed items have the single option `FN` with a required root cause |
| 23 | 31 | OI-7 budget set from the cap-derived bound (no report exists to estimate on) |
| 24 | 31 | `so4-heldout` and `sensitivity` registered with no entries; `e7-corpus` with the four specced projects (additions are `prereg.json` v2+) |
| 25 | 31 | E1 Claude model ids are the current id of each tier, to be confirmed at the generator-protocol freeze |
| 26 | 32 | Fix `50396b2`: the frozen-instrument export carries U4's judge freeze |
| 27 | 33 | Fix `dd7ed6c`: `--self-test` added to `rescore`, `select-corpus`, `fetch-corpus` and `prepare-bases` (BR-U5b-73). Each runs a built-in known-bad input with no subprocess or network and exits 1; `self-test.test.ts` +4. No registered artefact changed |
| 28 | 35 | The SO4 floor escalation row was added to §7 on `v1.2e` after the merge (docs-only), because the merged summary had left it out |
| 29 | 35 | `git status --porcelain` in `<MAIN>` is not empty: it shows only the pre-existing untracked `.claude/sdd-cache/`, which is not U5b's |

## 7. Open items still open

| # | Item | Owner | Blocks |
|---|---|---|---|
| SO4 floor (escalated) | Step 25: held-out golden capacity on the remapped specs is 69 < 80 at k = 3 (`CAT_SHORTFALL`; k = 2 → 47). The floor-check box stays open pending the author decision (BR-U5a-37); dev-nest and the added projects (OI-12) are not counted yet | author | SO4 held-out run |
| OI-11 | `BaselineSelection` unit id → file path mapping; `prepare-bases` reads U5b's `StoredBaselineSelection` projection until it is settled | U4 + U5a | corpus `prepare-bases` (Build and Test) |
| OI-12 | Specs for dev-nest and the added projects. Is an additive `prereg.json` bump a deviation? | author | first E7 run on those projects |
| OI-1 | R-1..R-16 and the §12 amendments go to the clarifications file | orchestrator | none |
| OI-U5b-P2-1 | CI has no `tsc -p tsconfig.scripts.json` step (`.github/**` is outside the U5b allow-list). The step is local in Gate T | orchestrator | none |
| OI-U5b-P2-4 | `Docs/generator-protocol.md`, `Docs/operator-catalogue.md` and the U4 judge pre-registration are still DRAFT. Each freeze that changes a registered byte, and each DV-U5b-24 / 25 addition, is a `prereg.json` v2+ with a reason. `FIXTURE_SPECS` must admit the SP-FF-S03 layered spec before the sensitivity plan runs | author / Build and Test | the run each one affects |
| Gemini id | No verified Gemini labeller id is pinned in `Docs/` yet (BR-U4-VRD-09); `--model` is required | author | live labelling |

Settled during U5b: OI-2, OI-3, OI-7 (value 4000, DV-U5b-23), OI-9, OI-10, OI-13, OI-U5b-P2-2, OI-U5b-P2-3.

## 8. Hand-offs to Build and Test (in order)

1. FR-18 re-baseline (golden suite), with its own attributed `CHANGES.md` lines. It must not start before the `prereg.json` version that covers it.
2. `prepare-bases` on the corpus bases after U4's baseline selections exist (OI-11). `fetch-corpus --dest ../daedalus-corpus` comes first.
3. The sensitivity plan run (SP-* probe copies from `mutate`; DV-U5b-24 additions registered first).
4. The latency gate (`experiments/latency-gate`, ghostfolio `apps/api`).
5. E1, E7 and SO4 runs (`e1-grid`, `e7-corpus`, `so4-heldout`). Each is checked by `--check-prereg` and writes `results/<plan-id>` only then.
6. Live labelling last: `llm-label --estimate` on the real label plan within `labellingBudgetCalls`, a pinned Gemini id, `--mode record --provider gemini`, then the blinded audit and agreement.
