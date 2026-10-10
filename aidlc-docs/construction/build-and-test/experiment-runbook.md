# Experiment runbook — v1.2E registered runs (after P-U6)

**Date**: 2026-10-09; examiner-review fixes (stages 0b and 0c, 1.3, `../daedalus-so4`) 2026-10-09. **Registration**: `corpus/prereg.json` version 4 (P-U6; ADR-021 items 4, 5, 7, 8, 10). **Owner**:
Build and Test (BT-B, BT-D, BT-E, BT-F resume only after P-U6, ADR-021 item 7). This is the command sequence the
registered experiments follow, stage by stage. Each stage reads only what the stage before it wrote. The P-U6
dry run (§3) ran the whole chain on fixtures, with the Mock judge and the Mock labeller, in a scratch output
directory.

## 0. Rules for every stage

- **Gate first.** Before a run, `npx tsx scripts/run-experiment-cli.ts --check-prereg experiments/<plan>/plan.json`
  must print `pre-registration v<N> ok`. CI runs the same check on every `experiments/*/plan.json` for PRs to
  `v1.2e`. If you change a registered artefact, including a plan's entries, make a dated bump first:
  `npx tsx scripts/register-prereg-cli.ts --reason "<label> = …"`, with a section in `Docs/prereg-reasons.md`.
- **Resources.** Never start a Neo4j container. Use the shared lane database (`bolt://localhost:7693`, credentials
  from `~/.daedalus-bt.env`, loaded with `set -a; . ~/.daedalus-bt.env; set +a`, never printed). Hold the lane lock
  around every graph-writing command:
  `until mkdir "$HOME/.daedalus-7693.lock" 2>/dev/null; do sleep 20; done; <command>; rmdir "$HOME/.daedalus-7693.lock"`.
  Run one heavy command at a time. Wait if the 1-minute load is above 40. `run-experiment` takes
  `--neo4j-container daedalus-neo4j-bt` for the environment record (read-only `docker exec`).
- **Live calls.** Live judge calls happen only in the full-mode plans (`fixtures`, `e7-corpus`, `e1-grid`), with
  the pinned `claude-cli` judge recording into `experiments/<plan>/cassettes`. Live labeller calls happen only in
  stage 9, with the `agy` route, which counts invocations against the plan budget. Every other stage makes no model
  call.
- **Paths.** Corpus clones are at `../daedalus-corpus` (`fetch-corpus`). E1 outcomes are at
  `../daedalus-e1-outcomes`. SP-* probe copies are at `../daedalus-sp-probes`. The SO4 prepared bases, manifest and
  seeded copies are at `../daedalus-so4` (§3). All of these are durable sibling directories, outside every checkout
  and never committed. A registered plan refers to them only by repository-relative paths (`../daedalus-…`), never by
  a scratch or `/private/tmp` path: `so4-plan-entries` refuses an absolute `--manifest` or `--copies` (exit 2).
  Results go to `results/<plan-id>/`. The sealed audit allocation (6.2) goes to `../daedalus-sealed/`, durable and
  not opened before the 6.3 commit, because a session scratch directory can be wiped between sessions. `$SCRATCH`
  holds only throwaway files that no stage reads.

## 0b. Judge freeze (P-4) — before any full-mode run

The symbolic-only stages, §1 (SO2) and §3 (SO4), may run before this stage. §2 (sensitivity) is symbolic-only too,
but it is registered by its own bump (P-3). No full-mode plan (`fixtures`, §4 `e7-corpus`, §5 `e1-grid`) runs before
all of the following are committed:
1. **Rubric freeze**: `src/llm-critic/rubric.ts` with `FROZEN_SHA256` set, and its test green (B&T Step 44).
2. **`Docs/judge-preregistration.md`** has left DRAFT. Its frozen rows (judge, CLI pin, effort, `unitCap`,
   `runsPerEvaluation`, the degradation ladder) equal the code.
3. **The final frozen-instrument export**: `export-frozen-instrument-cli.ts --final`, committed together with
   **P-4** (`register-prereg-cli.ts --reason "P-4 = judge freeze …"`). `--check-prereg` then prints the P-4 version
   for every plan (B&T Step 45).
4. **The full-mode golden lane L0** has passed at the P-4 commit (B&T Step 46).

## 0c. Pre-run E7 judge-volume estimate — before §4

`e1-judge-volume-cli.ts --e7 --plan experiments/e7-corpus/plan.json --selections corpus/selections --out Docs/DiagnosticRuns/e7-judge-volume.md`.
It gives the per-base calls (1 init probe + 3 × the selected FF-N01 and FF-N02 units of the base's stored
selection), the sum and the cap ceiling. It is committed before §4, and the E7 ladder trigger compares measured
calls per window against it (`Docs/judge-preregistration.md`). The E1 counterpart is
`Docs/DiagnosticRuns/e1-judge-volume-estimate.md`.

## 1. SO2: latency gate and APG ablation (symbolic-only, no model call)

| # | Command | Writes | Hands to |
|---|---|---|---|
| 1.1 | `run-experiment-cli.ts experiments/latency-gate/plan.json --neo4j-container daedalus-neo4j-bt` | `results/latency-gate/{runs,reports}` | 1.2 |
| 1.2 | `so2-metrics-cli.ts tables --run-dir results/latency-gate --out results/latency-gate/so2` | `latency.csv`, `graph_coverage.csv`, `gate.json` (the **only** H13 gate source) | B&T Step 24 (ADR-016 e; P-2 if the strategy flips) |
| 1.3 | per in-scope base: `so2-metrics-cli.ts profile --project <path> --spec <spec> --project-id <projectId> --reps 3 --out results/latency-gate/so2/profile-<projectId>` (lane lock: it ingests). There is one directory per base, because the file names are fixed. It refuses an `--out` that already holds `profile.csv` or `scc_components.csv` | `profile-<projectId>/profile.csv`, `profile-<projectId>/scc_components.csv` | 1.6 |
| 1.4 | `so2-metrics-cli.ts arms --plan experiments/apg-ablation/plan.json --out results/apg-ablation/so2` (exit 1 if a base's arms are identical) | `apg_arms.csv` | 1.5 |
| 1.5 | `run-experiment-cli.ts experiments/apg-ablation/plan.json …`, then `so2-metrics-cli.ts ablation --run-dir results/apg-ablation --out results/apg-ablation/so2` | `apg_ablation.csv`, `apg_ablation_summary.csv` | Ch8.1 |
| 1.6 | `so2-metrics-cli.ts tables --run-dir results/latency-gate --run-dir results/apg-ablation --out results/apg-ablation/so2` (not `results/so2`: the results guard BR-U5b-56 allows only `results/pre-tag/` and `results/<registered plan id>/`; ADR-024 item 2) | `nfr07_latency.csv` (the NFR-07 table) | figures (`--so2-dir`) |
| 1.7 | `so2-metrics-cli.ts flows-to --plan experiments/apg-ablation/plan.json --out results/apg-ablation/so2` (extraction only, no database; not `results/e7-corpus/so2`, which holds no RunRecord before §4 and is refused by the results guard; ADR-024 item 2) | `flows_to_stores.csv` | Ch8.1 |

## 2. Sensitivity (BT-E)

The SP-* probe entries are added to `experiments/sensitivity/plan.json` after FR-18. That change is registered by P-3
before the plan runs. Then: `run-experiment-cli.ts experiments/sensitivity/plan.json …`,
`rescore-cli.ts` (sweeps), and `aggregate-cli.ts --runs results/sensitivity --plan experiments/sensitivity/plan.json --sensitivity <results.json> --out results/sensitivity/agg`.

## 3. SO4 held-out (symbolic-only, no model call)

| # | Command | Writes | Hands to |
|---|---|---|---|
| 3.1 | `prepare-bases-cli.ts --clones ../daedalus-corpus --selections corpus/selections --only realworld-test,ghostfolio-test,truthy-demo,dry-run-test,zhuravlevma__nestjs-active-record,nestjslatam__ddd,v-aguiar__valex --out ../daedalus-so4/prepared-bases-7.json` | prepared bases (`../daedalus-so4`, durable, never committed) | 3.2, 6.1 |
| 3.2 | split the prepared bases, one file per base: `node -e` over `../daedalus-so4/prepared-bases-7.json` writing each element to `../daedalus-so4/bases/<projectId>.json`; then per base × catalogue operator: `mutate.ts --base ../daedalus-so4/bases/<projectId>.json --spec corpus/specs/<projectId>.yaml --operator <id> --manifest ../daedalus-so4/manifest.json --out ../daedalus-so4/copies --split held-out --k 2` (k = 2, frozen; `--base` takes one prepared base, not the 7-base array; ADR-024 item 2) | manifest rows and rejections, seeded copies (`../daedalus-so4`) | 3.3 |
| 3.3 | `so4-plan-entries-cli.ts --plan experiments/so4-heldout/plan.json --manifest ../daedalus-so4/manifest.json --copies ../daedalus-so4/copies --out experiments/so4-heldout/plan.json` (repository-relative; an absolute path is refused) | the seeded entries (ADR-021 item 9 form) after the seven baseline entries | 3.4 |
| 3.4 | commit the plan, then `register-prereg-cli.ts --reason "…so4-heldout seeded entries…"`, then `--check-prereg` | `corpus/prereg.json` v<N+1> | 3.5 |
| 3.5 | `run-experiment-cli.ts experiments/so4-heldout/plan.json --neo4j-container daedalus-neo4j-bt` | baseline and seeded runs | 3.6 |
| 3.6 | `build-score-case-cli.ts --runs results/so4-heldout --out results/so4-heldout/case` | score case (`manifest.json`, `reports/`) | 3.7 |
| 3.7 | `score-golden-cli.ts --case results/so4-heldout/case --label-items results/so4-heldout/label-items.json --out results/so4-heldout/score-strict.json` | strict score, P1 items, missed seeds | 6.1 |

## 4. E7 corpus (full mode, live judge)

**Needs** stage 0b (P-4) and stage 0c (the committed E7 judge-volume estimate).

`run-experiment-cli.ts experiments/e7-corpus/plan.json --neo4j-container daedalus-neo4j-bt` → `results/e7-corpus`.
These seven bases are the P2 source (6.1). Apply the degradation ladder only by its registered rules
(`Docs/threats-to-validity.md` §4).

Then the P2 v1 side (analysis plan §10 B8; symbolic-only, no model call; lane lock):
`run-experiment-cli.ts experiments/e7-corpus-v1sym/plan.json --neo4j-container daedalus-neo4j-bt` →
`results/e7-corpus-v1sym` (the plan registers `instrument: v1`; no `--instrument` flag is needed).

## 5. E1 grid (live generator, then live judge)

**Needs** stage 0b (P-4). Step 3, the `fixtures` full-mode run, needs it too.

1. `generate-projects.ts --plan experiments/e1-grid/generator-plan.json` (the registered generator plan; it writes
   `../daedalus-e1-outcomes/<model>/<task>/<level>/run-<i>/`; a stopped cell is restarted atomically).
2. `run-experiment-cli.ts experiments/e1-grid/plan.json --neo4j-container daedalus-neo4j-bt` → 54 records, one
   per coordinate (a missing or protocol-mismatched cell is `not-run` with its `GEN-*` code).
3. `run-experiment-cli.ts experiments/fixtures/plan.json …` → the fixture P4 units.
4. **ADR-028 two-pass step (analysis plan §12.3; prereg v14/v15).** Pass 1 is step 2 itself: the judge calls are recorded
   under the registered rule (default `--neural-aggregation registered`, `--cassette-mode record`) into the plan's
   `outDir` `results/e1-grid/`. Pass 2 makes no judge call: `run-experiment-cli.ts experiments/e1-grid/plan.json
   --neo4j-container daedalus-neo4j-bt --cassette-mode replay --neural-aggregation proportional --out-dir
   results/e1-grid/agg-proportional`. **`--out-dir` rule:** pass 2 always names its own directory under the plan's
   results directory and never the registered `outDir`, so the registered records are never overwritten; a cassette
   miss stops pass 2 (`JUDGE_RUN_INCOMPLETE`) and is never resolved by recording. Check the cassette count is unchanged,
   then `compare-aggregations-cli.ts --registered results/e1-grid --variant results/e1-grid/agg-proportional --out
   results/e1-grid/agg-proportional` (`reading` = pre-registered, derived) and `aggregate-cli.ts --runs
   results/e1-grid/agg-proportional --out results/e1-grid/agg-proportional --neural-aggregation proportional`.
   A cell whose judge reused a baseline selection (SEL-07) has no proportional reading (`NEURAL_AGGREGATION_UNDEFINED`).

## 6. Labelling (ADR-021 items 6 and 8; live `agy` only in 6.4)

| # | Command | Writes | Hands to |
|---|---|---|---|
| 6.1 | `build-label-plan-cli.ts --out results/labels --case results/so4-heldout/case --label-items results/so4-heldout/label-items.json --copies ../daedalus-so4/copies --bases ../daedalus-so4/prepared-bases-7.json --corpus-runs results/e7-corpus --corpus-v1-runs results/e7-corpus-v1sym --e1-runs results/e1-grid --fixture-runs results/fixtures` | `label-plan.json` (budget, `auditSeed` 6105), `fn-causes.json`, `judge-verdicts.json`, `label-plan-summary.json` (Kish n_eff per row, context cut by kind, escalation if any) | 6.2–6.6 |
| 6.2 | `llm-label-cli.ts --allocate-audit --plan results/labels/label-plan.json --plan-id <id> --out audit/view --allocation-out ../daedalus-sealed/<id>.allocation.json` (**before** 6.4; label-blind, kind × population) | the audit view; the sealed allocation | 6.3 |
| 6.3 | The author labels the view and commits `audit/<id>.json`. Do not open the allocation or any labels before this commit. | the committed audit | 6.6 |
| 6.4 | `llm-label-cli.ts --plan results/labels/label-plan.json --estimate`, then `--mode record --cassette-dir experiments/labels/cassettes --out results/labels/labels.json` (route `agy`, model `gemini-3.1-pro-high` from the plan; split over ≥ 2 weeks of quota; `LABEL_BUDGET_STOP` before any call that could exceed the budget) | labels, cassettes | 6.5, 6.6, 7 |
| 6.5 | `llm-label-cli.ts --usage --cassette-dir experiments/labels/cassettes` → record the input tokens per call in `Docs/labeller-route.md` §6 (registered: this is a bump) | token figures | — |
| 6.6 | `llm-label-cli.ts --agreement --plan results/labels/label-plan.json --labels results/labels/labels.json --allocation ../daedalus-sealed/<id>.allocation.json --audit audit/<id>.json --judge-verdicts results/labels/judge-verdicts.json --fn-causes results/labels/fn-causes.json --out results/labels/labelling.json` | agreement rows (κ / AC1 intervals, `taxonomy_rule`), audit allocation, label budget, FP/FN taxonomy | 7 |
| 6.7 | `score-golden-cli.ts --case results/so4-heldout/case --labels results/labels/labels.json --out results/so4-heldout/score.json` | labelled score (FP-labelled) | 7 |
| 6.8 | (exploratory) `so5-open-coding-cli.ts --labels results/labels/labels.json --runs results/e1-grid --out results/e1-grid/open-coding` | open-coding input and key | Ch9 |

## 7. Aggregation, figures, SO1 and SO2 metrics

| # | Command | Writes |
|---|---|---|
| 7.1 | `aggregate-cli.ts --runs results/so4-heldout --plan experiments/so4-heldout/plan.json --score results/so4-heldout/score.json --manifest results/so4-heldout/case/manifest.json --labelling results/labels/labelling.json --golden-registered 85 --out results/so4-heldout/agg` | `prf_*.csv`, `precision_*.csv`, `golden_instances.csv`, `seed_coverage.csv`, labeller tables |
| 7.2 | `aggregate-cli.ts --runs results/e1-grid --plan experiments/e1-grid/plan.json --labels results/labels/labels.json --labelling results/labels/labelling.json --out results/e1-grid/agg` (no P3 label: label-dependent `fpat_*` are N/A; the profile is in `so5_patterns.csv` `basis = symbolic`) | `so5_grid.csv`, `so5_patterns.csv`, `so5_tests.csv` |
| 7.3 | `aggregate-cli.ts --runs results/e7-corpus --plan experiments/e7-corpus/plan.json --out results/e7-corpus/agg`; the same for `fixtures`, `latency-gate`, `apg-ablation` | per-plan tables (`latency.csv` is descriptive; the gate is `gate.json`) |
| 7.4 | `figures-cli.ts --csv-dir <plan agg dir> --so2-dir results/apg-ablation/so2 --out results/<plan>/figures [--split held-out]` | thesis figures |
| 7.5 | `so1-metrics-cli.ts --out results/pre-tag/so1-metrics-<sha>.json` | SO1 instrument metrics |

## 8. P-U6 dry run (2026-10-09, fixtures only, Mock, scratch)

**Setup.** This was a scratch clone of `v1.2e-u6-register` at `3c4bcdd`, with `node_modules` linked, under the
session scratchpad. Three registered plans were edited **in the clone only**: `fixtures` and `e1-grid` got judge
`mock` / `mock-model`; `e1-grid` and its generator plan got `outcomesRoot` = the pilot outputs; `so4-heldout` got
one baseline entry, `fixtures/correct-reference`. These edits were registered by two local bumps (v5, v6) that were
never pushed. `PATH` held only `node`, `npx` and `docker`, so no `claude`, `agy` or `gemini` binary could be
reached. Graph-writing runs held the lane lock on `bolt://localhost:7693`. No live model call was made.

| Stage | Command (in the clone; `D` = scratch dir) | Result |
|---|---|---|
| generate / reuse | the pilot outputs `../daedalus-e1-outcomes/pilot` (3 cells, `pilot: true`, `orderSeed` 0) | reused, never rewritten |
| mutate | `mutate.ts --base fixtures/correct-reference --spec specs/clean-arch.yaml --operator MO-S01\|MO-P01\|MO-C04 --manifest $D/so4/manifest.json --out $D/so4/copies --k 2` | 6 rows, 0 rejections (split `dev`: a fixture base cannot be held-out, BR-U5a-02) |
| SO4 entries | `so4-plan-entries-cli.ts --plan experiments/so4-heldout/plan.json --manifest $D/so4/manifest.json --copies $D/so4/copies --out experiments/so4-heldout/plan.json` | 1 baseline entry, 6 seeded entries |
| gate | `register-prereg-cli.ts` (local), `--check-prereg` × 3 | `pre-registration v6 ok: 65 registered artefacts unchanged` |
| evaluate | `run-experiment-cli.ts experiments/{fixtures,so4-heldout,e1-grid}/plan.json --out-dir $D/results/<plan> --neo4j-container daedalus-neo4j-bt` | fixtures: 5 accepted (Mock judge, 49 cassette entries); so4-heldout: 7 accepted; e1-grid: 54 not-run (3 `GEN-PROTOCOL-MISMATCH`, the pilot cells; 51 `GEN-MISSING`) |
| score case | `build-score-case-cli.ts --runs $D/results/so4-heldout --out $D/case` | 6 rows, 6 paired, 0 unusable |
| score-golden | `score-golden-cli.ts --case $D/case --label-items $D/label-items.json --out $D/score-strict.json` | exit 0; P1 0, missed 0, rejected pairs 0 |
| label plan | `build-label-plan-cli.ts --out $D/label --config <registered config, provider mock> --case $D/case --label-items $D/label-items.json --copies $D/so4/copies --corpus-runs $D/results/so4-heldout --e1-runs $D/results/e1-grid --fixture-runs $D/results/fixtures` | P4 10, P2 2, P3 0; 24 calls + 30 reserve ≤ 300; Kish n_eff fixtures 8.7, P2 1.8 (counts only); 0 contexts cut; 54 judge verdicts |
| audit draw | `llm-label-cli.ts --allocate-audit --plan $D/label/label-plan.json --plan-id dryrun --out $D/audit-view --allocation-out $D/sealed/dryrun.allocation.json` | 12 items, seed 6105, before any label |
| llm-label | `llm-label-cli.ts --plan $D/label/label-plan.json --mode record --provider mock --cassette-dir $D/label/cassettes --out $D/label/labels.json`; the same with `--mode replay` | 12 items in 24 invocations; P4 `pass` 10, P2 `TP` 2; replay byte-identical; `--usage`: 23 cassette entries, median 569 input tokens |
| audit + agreement | `audit/dryrun.json` written from the view only (first canonical option of each item, label-blind) and committed in the clone; `llm-label-cli.ts --agreement … --judge-verdicts $D/label/judge-verdicts.json --fn-causes $D/label/fn-causes.json --resamples 2000 --out $D/label/labelling.json` | 5 rows: run vs run n 12, κ 1, κ CI [1, 1], `taxonomy_rule` `as-registered`; judge vs panel n 10 (Mock judge vs Mock labeller); panel vs audit n 12 |
| labelled score | `score-golden-cli.ts --case $D/case --labels $D/label/labels.json --out $D/score.json` | exit 0 |
| aggregate | `aggregate-cli.ts` for so4-heldout (with `--score`, `--manifest`, `--labelling`, `--golden-registered 6`), fixtures (`--labelling`) and e1-grid (`--labels`) | 28 CSV + 1 SVG each. so4: `prf_overall` 4 rows, `seed_coverage` 6, `golden_instances` N 0 (every seed is `dev`), `precision_baseline` n 2, n_eff 1.8. e1: `so5_grid` 54 rows, all with a `GEN-*` code. Aggregate `latency.csv` has the new columns. |
| SO2 | `so2-metrics-cli.ts tables --run-dir $D/results/fixtures --run-dir $D/results/so4-heldout --out $D/so2` | 12 runs; `gate.json`: fixtures pass, so4-heldout pass |
| SO1 | `so1-metrics-cli.ts --out $D/so1-metrics.json` | exit 0 |
| SO5 open coding | `so5-open-coding-cli.ts --labels $D/label/labels.json --runs $D/results/e1-grid --out $D/open-coding` | 0 items (no valid E1 cell) |
| figures | `figures-cli.ts --csv-dir $D/agg/<plan> --so2-dir $D/so2 --out $D/fig/<plan>` (+ `--split dev` for so4) | so4 (dev): 5 SVG (prf by function and by tag, SO2 latency and coverage, threshold sensitivity); fixtures 3; e1-grid 2 (SO5 heatmap, SO2 latency) |

**Hand-offs fixed by the dry run.** These fixes are in the P-U6 PR and are not registered artefacts:
1. No script wrote the seeded so4-heldout entries from the manifest. The new script is `so4-plan-entries-cli.ts`.
2. `llm-label --provider mock` used the judge-shaped Mock, so every label was `uncertain` (`invalid-run`). The new
   labeller-shaped `MockLabellerProvider` answers validly.
3. `build-label-plan` required `--bases` even when no missed seed needs it. It is now optional.

**Not exercised by the dry run** (by construction): held-out N, which needs corpus bases; valid E1 cells, because
the pilot outcomes are `pilot: true`, so P3/P4-E1 and the SO5 tests did not run; live judge and labeller calls;
missed-seed items (every fixture seed was detected); the escalation path (P1 + MS = 0). These paths are covered by
the unit tests.
