# Independent reproduction audit of the v1.2E thesis results (2026-10-10)

**Run date**: 2026-10-11 (UTC), scheduled audit. **Audited ref**: `v1.2e` at `1543ba9`. **Auditor stance**: skeptical,
re-derive everything that can be re-derived without a firewall evaluation, a Neo4j database or a model call.
**Out of scope**: `results/e1-grid/` (E1 still running elsewhere). No code or result file was changed; every
re-run wrote into a scratch directory or into a detached scratch worktree, never into this checkout.

## 1. Method

1. **Environment.** `git fetch && git checkout v1.2e`; `npm ci` (exit 0, lockfile unchanged across every producing
   commit below, so one `node_modules` served all worktrees). Node v22.22.0. No Docker daemon, so no Neo4j.
2. **Tests.** `npm test -- --maxWorkers=2`: 241 of 243 suites, 3422 of 3424 tests pass. The two failures are
   environmental (see 4.1). Golden suites (`test:golden`, `test:golden:full`) were skipped: they need Neo4j.
3. **Pre-registration gate.** `npx tsx scripts/run-experiment-cli.ts --check-prereg experiments/<plan>/plan.json` for
   all 10 plans (apg-ablation, e1-grid, e7-corpus-v1sym, e7-corpus, fixtures, latency-gate, real-pairs, sensitivity,
   so4-heldout, tool-comparison): every one prints `pre-registration v20 ok: 77 registered artefacts unchanged`.
4. **Provenance.** For each committed table the producing script and flags were taken from the experiment runbook
   (`aidlc-docs/construction/build-and-test/experiment-runbook.md`), ADR-024 to ADR-030, `aidlc-docs/audit.md` and the
   commit that added the file. Where the flags were not written down, candidate invocations were tried and the one
   that reproduces is named below.
5. **Re-run.** Each aggregation or scoring script was re-run from the committed run records, reports, labels and
   cassettes into a scratch directory, first at `HEAD`, and, when `HEAD` differed, again in a detached worktree at
   the commit that produced the file (`902c85b`, `00c315a`, `1ddb6e4`, `4da58ac`, `bdb4869`, `9c146cb`, `bf2855d`,
   `53cfaed`). Comparison is `cmp` (byte equality). Scripts with fixed output paths (`tool-comparison-cli.ts`) ran in
   a scratch worktree and were checked with `git status` there.
6. **No live calls.** No firewall evaluation, no judge and no labeller call was made. `llm-label --mode replay` was
   used for the labels; in replay mode the provider is a disabled stand-in that rejects every call
   (`scripts/llm-label.ts`, the `disabled` provider), so it only reads the committed cassettes.
7. **Independent recomputation.** Headline numbers were recomputed in standalone Python from the committed CSVs,
   score JSON, reports and labels (own Wilson, Clopper-Pearson, Kish n_eff, Cohen's kappa, Gwet's AC1 and a
   10 000-resample cell percentile bootstrap with a different RNG), not by calling the repository's code.

### Input substitutions (disclosed)

| Missing input | Used instead | Effect |
|---|---|---|
| `../daedalus-so4/manifest.json` (named by every seeded SO4 RunRecord, not committed, not hashed) | the committed copy `results/so4-heldout/case/manifest.json`, passed as `--manifest` to `build-score-case`, and copied to `../daedalus-so4/manifest.json` beside the scratch worktree for `tool-comparison score-comparison` | case rows and every tool-comparison table reproduce; this proves consistency with the committed copy, not with the original external file |
| `../daedalus-sp-probes/manifest.json` (sensitivity) | the committed `results/sensitivity/{,step31/}case/manifest.json` | same |
| dependency-cruiser install | `npm ci --ignore-scripts` in `experiments/tool-comparison/depcruise` of the scratch worktree (locked, 18.4.0) | needed only for the version string in `summary*.json` |

## 2. Per-table verdicts

"Identical" means byte-identical. "@commit" means identical when re-run at the producing commit; the HEAD column
says what the current code gives.

| Table(s) | Producer and flags that reproduce | Verdict | At HEAD |
|---|---|---|---|
| `so4-heldout/case/{manifest,case-rows}.json` | `build-score-case --runs results/so4-heldout --manifest <committed copy>` | identical (substituted manifest) | identical |
| `so4-heldout/score-strict.json`, `label-items.json` | `score-golden --case results/so4-heldout/case --label-items ...` | identical @902c85b | differ: HEAD applies matching rule 1.2.0 (FP 13 to 0); expected |
| `so4-heldout/score-corrected.json`, `label-items-corrected.json` | `score-golden --case results/so4-heldout/case-corrected ...` | identical | identical |
| `so4-heldout/score.json` (labels-based score) | `score-golden --case results/so4-heldout/case --labels results/labels/labels.json` | identical | identical |
| `so4-heldout/case-corrected/manifest.json` | no script; the two `v-aguiar__valex:MO-S01` rows edited by the ADR-025 style guard | not reproducible by script; diff against `case/manifest.json` verified to be exactly those 2 rows (`functionIds` [] and the FF-S01 `disabledFunctionIds` reason) | n/a |
| `so4-heldout/v2/case/{manifest,case-rows}.json` | `build-score-case --runs results/so4-heldout/v2 --manifest results/so4-heldout/case-corrected/manifest.json` | identical | identical |
| `so4-heldout/v2/score.json` | `score-golden --case results/so4-heldout/v2/case` | identical | identical |
| `so4-heldout/agg-strict/` (28 CSV) | `aggregate --runs results/so4-heldout --plan experiments/so4-heldout/plan.json --score score-strict.json --manifest case/manifest.json --golden-registered 85` | identical @902c85b (28/28) | 25 identical; `ahs_by_project`, `runs`, `precision_baseline` gain later columns, all shared columns equal |
| `so4-heldout/agg-corrected/` (28 CSV) | same with `score-corrected.json`, `case-corrected/manifest.json` | identical @00c315a (28/28) | as above |
| `so4-heldout/v2/agg/` (28 CSV) | same with `--runs results/so4-heldout/v2`, `v2/score.json`, `v2/case/manifest.json` | identical @1ddb6e4 (28/28) | as above |
| `so4-heldout/agg/` (28 CSV + SVG) | runbook 7.1 (`--score score.json --manifest case/manifest.json --labelling results/labels/labelling.json --golden-registered 85`) | identical (29/29) | identical |
| `apg-ablation/so2/apg_ablation{,_summary}.csv` | `so2-metrics ablation --run-dir results/apg-ablation` | identical | identical |
| `apg-ablation/so2/{gate.json,graph_coverage,latency,nfr07_latency}.csv` | `so2-metrics tables --run-dir results/apg-ablation` (**not** runbook 1.6, which adds `--run-dir results/latency-gate` and gives a different file) | identical | identical |
| `apg-ablation/so2/{apg_arms,flows_to_stores}.csv` | `so2-metrics arms / flows-to` (APG extraction over `../daedalus-corpus`) | not reproducible: corpus clones absent | n/a |
| `apg-ablation/v2/so2/` (6 files) | `ablation` and `tables` with `--run-dir results/apg-ablation/v2` | identical | identical |
| `latency-gate/so2/{gate.json,graph_coverage,latency,nfr07_latency}.csv` | runbook 1.2 | identical | identical |
| `latency-gate/so2/profile-*/{profile,scc_components}.csv` (8) | `so2-metrics profile` (ingests into Neo4j, times queries) | not reproducible: needs corpus clones and Neo4j, and is a timing measurement | n/a |
| `pre-tag/so1-metrics-53cfaed4a313.json` | `so1-metrics --out ...` | identical @53cfaed | not run (the file embeds its commit) |
| `pre-tag/fixtures-*.json`, `layered-*.json`, `layered-*.report.json` (6) | firewall `evaluate` / `so1-layered-acceptance` | not re-run: evaluation outputs (audit rule) | n/a |
| `sensitivity/case/*`, `score.json`, `function-sensitivity.json` | `build-score-case` (substituted manifest); `score-golden --case results/sensitivity/case --sensitivity ... --plan experiments/sensitivity/plan.json` | identical @9c146cb | `score-golden` refuses (`SCORE_INPUT_REJECTED`: `specs/clean-arch.yaml` sha changed after the run); the guard working as designed |
| `sensitivity/agg/` (28 CSV) | `aggregate --runs results/sensitivity --plan ... --sensitivity function-sensitivity.json` (no `--score`) | identical @9c146cb (28/28) | not compared |
| `sensitivity/step31/` (case, score, function-sensitivity, 28 CSV) | same, `--later-disabled FF-CV01,FF-CV04` | identical @bf2855d | not compared |
| `e7-corpus/agg/` (28 CSV + SVG) | runbook 7.3 | identical @4da58ac (29/29) | 26 identical; 3 gain later columns, shared columns equal |
| `e7-corpus/agg-proportional/` (30 CSV + SVG) | `compare-aggregations --registered results/e7-corpus --variant results/e7-corpus/agg-proportional`, then `aggregate --runs results/e7-corpus/agg-proportional --neural-aggregation proportional` | identical (31/31) | identical |
| `e7-corpus/judge-diagnostics/` (4 CSV) | `judge-diagnostics --runs results/e7-corpus --cassettes experiments/e7-corpus/cassettes` | identical | identical |
| `e7-corpus/v1/ahs_v1_sensitivity.csv` | no script (hand-assembled from scratch `--instrument v1` evaluations) | not reproducible by script; all 18 rows cross-checked against `results/e7-corpus-v1sym` and `results/e7-corpus` reports: symbolic violation counts, AHS and verdicts all equal | n/a |
| `e7-corpus-v1sym/` | run records and reports only; no aggregate table is committed | nothing to reproduce | n/a |
| `labels/labels.json` | `llm-label --plan results/labels/label-plan.json --mode replay --cassette-dir results/labels/cassettes` (66 items, 142 replayed invocations, 0 live) | identical | identical |
| `labels/labelling.json` | `llm-label --agreement --plan ... --labels ... --judge-verdicts ... --fn-causes ...` (no allocation, no audit yet) | identical | identical |
| `labels/{label-plan,label-plan-summary,fn-causes,judge-verdicts}.json` | `build-label-plan` (runbook 6.1) | not reproducible: needs `../daedalus-so4/prepared-bases-7.json` and `../daedalus-so4/copies` (refused: `no prepared base nestjslatam__ddd in --bases`) | n/a |
| `tool-comparison/` 12 tables (`recall`, `seeds`, `runtime`, `baseline-volume`, `baseline-unique-findings`, `summary`, each plain and `-dts`) | `tool-comparison-cli.ts score-comparison [--variant dts]` | identical (substituted manifest) | identical |
| `tool-comparison/depcruise/{configs,configs-dts}/*.json` (14), `translation.json` | `tool-comparison-cli.ts translate experiments/tool-comparison/plan.json [--variant dts]` | identical | identical |
| `real-pairs/` 8 tables (`pairs`, `resolved-findings`, `runtime`, `summary`, plain and `-dts`) | `tool-comparison-cli.ts score-pairs [--variant dts]` | identical | identical |
| `real-pairs/depcruise/{configs,configs-dts}/*.json` (4), `translation.json` | `translate experiments/real-pairs/plan.json [--variant dts]` | identical | identical |

### Verdict counts (files)

| Category | Files |
|---|---|
| Byte-identical (at HEAD or at the producing commit) | **310** |
| of which checked and identical at HEAD | 231 |
| of which checked at the producing commit only | 79 |
| Differing at the producing commit | **0** |
| Not reproducible (missing inputs, no producing script, or evaluation output excluded by the audit rules) | **22** (2 SO2 arms/flows-to, 8 latency profiles, 4 label-plan outputs, 1 `case-corrected` manifest, 1 `ahs_v1_sensitivity.csv`, 6 pre-tag evaluation outputs) |

Of the 79 files checked at their producing commit only, 14 differ at HEAD for documented reasons: 12 CSVs gain
columns added later (`neural_aggregation`, `cassette_mode`, `instrument`) with every shared column unchanged, and the
strict score and its label items move under matching rule 1.2.0. The sensitivity score is refused at HEAD because its
spec changed. The rest (sensitivity case and aggregates, SO1 metrics) were not compared at HEAD.

## 3. Headline confirmations (independent recomputation)

### SO4 held-out

| Reading | N scored (floor 80) | TP / FP / FN | Recall [cell bootstrap] | Precision [cell bootstrap; independent] | F1 [cell bootstrap] | Recall in coverage | Twin specificity |
|---|---|---|---|---|---|---|---|
| strict (rule 1.1.0) | 75 (short 5) | 67 / 13 / 8 | 0.893 [0.787, 0.974] | 0.838 [0.719, 0.970; Wilson 0.742, 0.903] | 0.865 [0.784, 0.943] | 67/69 = 0.971 | 60/73 |
| corrected (1.2.0, ADR-025 manifest) | 73 (short 7) | 67 / 0 / 6 | 0.918 [0.818, 1.000] | 1.000 [1.000, 1.000; CP 0.946, 1.000] | 0.957 [0.900, 1.000] | 67/67 = 1.000 | 68/73 |
| v2 (instrument 2) | 73 (short 7) | 67 / 0 / 6 | identical to corrected | identical | identical | identical | 68/73 |
| labels-based (`agg/`, runbook 7.1) | 75 (short 5) | 67 / 0 / 8 | 0.893 [0.787, 0.974] | 1.000 [1.000, 1.000; CP 0.946, 1.000] | 0.944 [0.881, 0.987] | 0.971 | 68/73 |

All point estimates, counts and the Wilson / Clopper-Pearson bounds match the committed CSVs to 6 dp. My own cell
bootstrap (different RNG) lands within 0.003 of every committed bound (strict recall 0.787 to 0.974, strict precision
0.717 to 0.970, strict F1 0.782 to 0.942). Registered held-out total 85; N = 75 / 73 is below the 80 floor, as the
`golden_instances.csv` statement says. Confirmed.

### Baseline precision (P2, Horvitz-Thompson, `uncertain` as non-TP, Wilson on Kish n_eff)

| Row | n items | TP / FP / uncertain | Weighted TP / total | n_eff | Precision [95% CI] |
|---|---|---|---|---|---|
| v2 | 24 | 11 / 5 / 8 | 591.53 / 1804.00 | 11.54 | **0.328 [0.132, 0.609]** |
| v1 | 30 | 11 / 8 / 11 | 591.53 / 2244.00 | 15.83 | **0.264 [0.110, 0.510]** |
| v1-only (counts only) | 6 | 0 / 3 / 3 | 0 / 440.00 | 5.35 | not reported |

Confirmed exactly from `labels.json` inclusion probabilities.

### Labelling agreement (run vs run)

n = 64 (66 items minus 2 with an invalid run 0), percent agreement 0.875, **Cohen's kappa 0.774**, bootstrap CI
committed [0.617, 0.913], mine [0.611, 0.912]: confirmed. **AC1 0.859** [0.769, 0.947] reproduces only with q = 6
categories (the union of all prompt option sets); with the 4 categories that occur, AC1 = 0.847 (see issue 7).
Judge-vs-panel and panel-vs-audit rows are empty (n 0), as expected before the author audit.

### E7 (9 projects, W_n = 0.080)

Recomputed from report-level `violatedWeight / functionCount` and the spec weights and thresholds (pass 0.80,
warning 0.65, soft-block 0.50):

| Project | AHS det | Registered | Proportional | Any-fail | JW registered | JW proportional |
|---|---|---|---|---|---|---|
| realworld-test | 0.721 | 0.743 warning | 0.723 warning | 0.687 warning | 0.800 pass | 0.729 warning |
| ghostfolio-test | 0.387 | 0.437 hard-block | 0.416 hard-block | 0.381 hard-block | 0.563 soft-block | 0.488 hard-block |
| truthy-demo | 0.387 | 0.441 hard-block | 0.430 hard-block | 0.385 hard-block | 0.566 soft-block | 0.528 soft-block |
| dry-run-test | 0.504 | 0.547 soft-block | 0.531 soft-block | 0.491 hard-block | 0.649 soft-block | 0.591 soft-block |
| zhuravlevma__nestjs-active-record | 0.571 | 0.608 soft-block | 0.603 soft-block | 0.552 soft-block | 0.695 warning | 0.678 warning |
| nestjslatam__ddd | 0.354 | 0.411 hard-block | 0.400 hard-block | 0.355 hard-block | 0.542 soft-block | 0.506 soft-block |
| v-aguiar__valex | 0.553 | 0.591 soft-block | 0.586 soft-block | 0.563 soft-block | 0.683 warning | 0.663 warning |
| zhuravlevma__typescript-ddd-architecture | 0.392 | 0.443 hard-block | 0.437 hard-block | 0.387 hard-block | 0.568 soft-block | 0.544 soft-block |
| raouf-b-dev__ecommerce-store-api | 0.175 | 0.247 hard-block | 0.233 hard-block | 0.191 hard-block | 0.415 hard-block | 0.365 hard-block |

Every AHS within 0.001 (rounding) and every verdict equal under every reading. Judge decomposition confirmed:
`delta_judge` (registered) 0.000 on 9/9, `judge_mattered` 0/9, `delta_dilution` 0.022 to 0.072; proportional moves 0
verdicts, any-fail moves 1 (dry-run-test soft-block to hard-block). Judge-weighted (2/7): verdict changes vs the
registered weights 7 / 5 / 2 and judge mattered 0 / 2 / 8 for registered / proportional / any-fail. Judge units:
331 valid (FF-N01 152, FF-N02 179), 73 fail, 258 pass. The v1 sensitivity rows match the v1sym reports (see table).

### Tool comparison (Wilson on instances; recomputed from `seeds.csv`)

| Group | n | DaedalusArch | dependency-cruiser | dependency-cruiser, dts variant |
|---|---|---|---|---|
| in-coverage seeds | 37 | 37 (0.906 to 1) | 28 (0.599 to 0.866) | 36 (0.862 to 0.995) |
| all seeds | 43 | 37 (0.727 to 0.934) | 34 (0.648 to 0.886) | 42 (0.879 to 0.996) |
| MO-X01 | 6 | 0 | 6 | 6 |
| MO-P01 | 13 | 13 | 4 | 12 |
| all twins (fired) | 42 | 2 | 2 | 2 |

87 seed rows, 85 scored (the 2 valex MO-S01 seeds are `not-applicable` under ADR-025). Confirmed.

### Real pairs

5 pairs. Detected (primary / strict): da-symbolic-all 2 / 0, da-comparable 2 / 1, depcruise 2 / 1, the same pairs
(p3, p4) in both variants. Recomputed from `pairs*.csv`; `detects` equals `resolved > 0` and `detects_strict` equals
"findings on touched files before, none after" on every row. Confirmed.

### SO2

- Latency gate (ghostfolio-test, 241 files): total 5 343 ms, FF-S02 547 ms, universal cycle 1 346 ms, budget
  30 000 ms, `gate.json` pass. Stage sum checks (universal metric is nested in compute-scores). Confirmed.
- APG ablation (9 projects, 22 functions each, 198 rows): 13 lost detections (FF-P02 and FF-P04 only), 4 gained
  (FF-P03 x3, FF-C04 x1), 2 fewer; violation deltas (AST-only minus full): dry-run -14, ghostfolio -61, truthy -13,
  realworld 0, fixtures +1, -1, -4, -2, -1. Summary recomputed from the per-function rows with 0 mismatches. v2
  repeats every per-function change and delta exactly (totals drop, deltas do not). Confirmed.

## 4. Issues, ranked by severity

### High

1. **The labels-based SO4 table mixes two scoring regimes.** `results/so4-heldout/agg/` and `score.json` score the
   **unguarded** case (`case/manifest.json`, where the two valex MO-S01 seeds still expect FF-S01) under **matching
   rule 1.2.0**. The result (N 75, FN 8, FP 0: R 0.893, P 1.000, F1 0.944) is neither the strict reading (rule 1.1.0,
   P 0.838, F1 0.865) nor the corrected or v2 reading (N 73, R 0.918, F1 0.957). Its P1 label set was drawn from the
   rule 1.1.0 items (34 items, 9 labelled FP); under rule 1.2.0 none of them is a seed FP, so `fp_labelled` = 0 is
   mechanical and the FP labels never enter a precision. The audit entry for the labelling step says "FP-labelled
   precision 1.0 (67 TP, 0 FP, unchanged from strict)", but strict FP is 13. Any thesis sentence that quotes the
   labelled F1 0.944 or "labelled precision 1.0" should name this hybrid, or the labelled score should be rebuilt on
   `case-corrected` (or `v2/case`).

### Medium

2. **Degenerate primary intervals.** When every cell is perfect, the primary cell percentile bootstrap returns a
   zero-width interval: precision 1.000 [1.000, 1.000] (corrected, v2, labelled), in-coverage recall 1.000 [1.000,
   1.000] (corrected, v2). `scripts/lib/stats.ts` switches to Clopper-Pearson at 0 or n only below 10 cells. The
   intervals are computed as their method says, but a [1, 1] "95% interval" overstates certainty; the independent
   Clopper-Pearson bound (0.946 to 1.000) is the only informative one. Separately, the tool comparison reports Wilson
   on instances (37/37 gives 0.906 to 1), so the same seeds carry different interval methods in different tables.
3. **Baseline precision is dominated by the `uncertain` rule, and its table is labelled SO4.** 8 of 24 v2 items (11
   of 30 v1) are `uncertain` and count as non-TP, as registered. Excluding them gives 0.608 (v2); counting them as
   TP gives 0.789. The Wilson-Kish interval [0.132, 0.609] does not carry this. The rows live in
   `results/so4-heldout/agg/precision_baseline.csv` under `plan_id = so4-heldout`, but the population is the E7
   corpus run (`results/e7-corpus`, 6 of 9 projects drawn, two of them E7-only bases that are not SO4 bases);
   `results/e7-corpus/agg/precision_baseline.csv` is header-only. In `prf_overall.csv` the `precision_baseline`
   column repeats the overall 0.328 on every stratum row, including `corpus-core` and `corpus-e7`, whose tier values
   are 0.591 and 0.212.
4. **Inputs outside the repository block full reproduction.** The SO4 manifest (`../daedalus-so4/manifest.json`) is
   named by every seeded RunRecord but not hashed anywhere, so the committed `case/manifest.json` cannot be tied to
   it; the label plan (and so the P2 draw, `fn-causes.json`, `judge-verdicts.json`) needs `../daedalus-so4` prepared
   bases and copies; SO2 arms, flows-to and profiles need `../daedalus-corpus`. `case-corrected/manifest.json` and
   `e7-corpus/v1/ahs_v1_sensitivity.csv` have no producing script (both were verified by hand here).

### Low

5. **Code drift against older tables.** HEAD no longer reproduces `agg-strict`, `agg-corrected`, `v2/agg` and
   `e7-corpus/agg` byte for byte (added columns), nor `score-strict.json` (rule 1.2.0), nor the sensitivity score
   (spec sha refusal). Values are unchanged where comparable, but the aggregate CSVs carry no stamp of the code commit
   that wrote them; a reader must find the producing commit from git history, as this audit did.
6. **`apg-ablation/so2` SO2 tables do not follow runbook 1.6.** The committed `nfr07_latency.csv`, `latency.csv`,
   `graph_coverage.csv` and `gate.json` reproduce only from `--run-dir results/apg-ablation` alone; runbook 1.6 names
   `--run-dir results/latency-gate --run-dir results/apg-ablation`, which adds the latency-gate row. Commit `bdf0e2a`
   says the combined NFR-07 table is kept outside the repository, so the in-repo "NFR-07 table" is the
   apg-ablation-only one.
7. **AC1 depends on an unstated category count.** `gwet_ac1` 0.859 uses q = 6, the union of every prompt's option
   set (including kinds absent from this sample); with the 4 categories that occur it is 0.847. Kappa is unaffected.
8. **`golden_instances.csv` `n_mutate_rejected` = 85 counts every mutate rejection** (44 seed-operator and 41
   twin-operator rejections), not golden ones, and happens to equal `n_registered` 85. Easy to misread as "85 golden
   rejected".

### Informational

9. The audit entry for E7 says "20/331 units had a split 3-run vote", while `judge_summary.csv` `units_split_vote` is
   0 everywhere. Both are right under their own definitions: 20 units have a 2-to-1 vote (11 pass, 9 fail); none has
   no majority.
10. `precision_incl_twins` 0.905 counts fired twin keys (7) rather than fired twins (5), by definition
    (`fpLabelled + twinLabelled`).
11. realworld-test under the judge-weighted registered reading is `pass` at 0.80008, 0.0001 above the threshold.
12. Under the registered neural rule every E7 project has `ahs_neuronal` 1.000 although 73 of 331 judged units fail,
    so "judge mattered 0/9" is structural to `majority-of-valid-units-v1`, as ADR-028 already states.
13. Test failures are environmental: `skeleton.test.ts` expects a write into a read-only directory to throw, which
    root ignores (the container runs as uid 0); `score-golden-acceptance.test.ts` needs a full clone and passes after
    `git fetch --unshallow`.

## 5. Bottom line

No committed aggregate table in scope was found to be wrong for its stated inputs and code: every table that could
be re-run reproduces byte for byte, at HEAD or at its producing commit, and every headline number recomputes
independently. The risks are interpretive and provenance-related: the labels-based SO4 row is a rule-version hybrid
(issue 1), several primary intervals are degenerate (issue 2), the baseline precision is sensitive to the
`uncertain` rule and is filed under SO4 (issue 3), and four groups of inputs live only outside the repository
(issue 4).
