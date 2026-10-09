# Performance Test Instructions — DaedalusArch v1.2E

> **Supersedes** the v1.0 performance-test instructions (US-NFR-2 targets). The earlier text stays in git history.
> **Cycle**: v1.2 Evaluation-Readiness, Build and Test (plan Steps 11, 21–25). **Date**: 2026-10-08.

## 1. Targets

| Requirement | Target | Where measured |
|---|---|---|
| NFR-v1.2E-03 | Under 5 000 ms per fixture project (extract + ingest + evaluate, symbolic-only) after Package nodes and edge properties were added | FR-18 result file `results/pre-tag/fixtures-<sha>.json` (Step 11) |
| NFR-v1.2E-07 | Every Cypher query has a timeout; the cycle search is bounded (`MAX_CYCLE_LENGTH` 10, `CYCLE_ROW_CAP` 100, `src/fitness-compiler/cypher-templates.ts`); a latency budget is stated for public projects up to 300 files | `results/latency-gate/so2-nfr07/nfr07_latency.csv` (`so2-metrics tables` over `results/latency-gate` and the full-APG arm of `results/apg-ablation`; ADR-021 item 8, SO2-3 a) and `results/latency-gate/so2/profile-<projectId>/profile.csv` (Steps 23, 25; §4, §6); `Docs/DiagnosticRuns/bt-latency-profile.md` only cites them |
| H13 / ADR-016 e | Latency gate on ghostfolio `apps/api`: both cycle queries (FF-S02 template, universal cycle metric) complete within `LATENCY_GATE_MS` = 30 000 ms (`scripts/run-experiment.ts`) | registered plan `experiments/latency-gate/plan.json` (Step 22) |

Steps 11 and 21–25 are held by escalation E-1 (catalogue freeze needs pending author decision (a)); the commands below are what they run once released.

## 2. NFR-03 fixture timings (FR-18)

```bash
npm run build
set -a; . ~/.daedalus-bt.env; set +a
for c in correct-reference variant-a-structural variant-b-pattern variant-c-everything variant-d-subtle; do
  node dist/cli/index.js evaluate --project fixtures/$c --spec specs/clean-arch.yaml --symbolic-only \
    --format json --verbose > "$SCRATCH/fr18/$c.json" 2> "$SCRATCH/fr18/$c.timings"
done
```

The `--verbose` stage timings give extract, ingest and total ms per fixture; each total must be under 5 000 ms. The result file stores the scrubbed reports with repository-relative paths, and `grep -c` of the Neo4j host:port and the password over it prints `0` (NFR-05).

## 3. H13 latency gate (registered plan)

```bash
npx tsx scripts/run-experiment-cli.ts --check-prereg experiments/latency-gate/plan.json
set -a; . ~/.daedalus-bt.env; set +a
mkdir "$HOME/.daedalus-7693.lock" && { npx tsx scripts/run-experiment-cli.ts experiments/latency-gate/plan.json; rmdir "$HOME/.daedalus-7693.lock"; }
# writes results/latency-gate/ (RunRecord, scrubbed report, EnvironmentRecord); run-experiment writes no CSV
npx tsx scripts/so2-metrics-cli.ts tables --run-dir results/latency-gate --out results/latency-gate/so2
# latency.csv (one row per RunRecord, rejected runs included), nfr07_latency.csv, graph_coverage.csv, gate.json
```

The gate is computed from **every** RunRecord of the plan, rejected ones included (ADR-021 SO2; audit SO2-1). The repository query timeout equals `LATENCY_GATE_MS` (30 000 ms), so a cycle query slower than the budget is killed: an FF-S02 `EVAL_002` (`function-timeout`) or a universal-cycle-metric `METRIC_001` with a transaction timeout (`metric-failed`) is `fallback-required`, not a failed step. Both cycle queries are timed: FF-S02 from its `functionResults` row, the universal cycle metric from the `universal-metric:cyclicDependencyCount` entry of `report.timings.stages` (audit SO2-2). A run whose cycle times cannot be read (no report, a non-timeout failure) is `inconclusive` and is escalated.

## 4. PROFILE capture (H13, NFR-07)

```bash
set -a; . ~/.daedalus-bt.env; set +a
mkdir "$HOME/.daedalus-7693.lock" && { npx tsx scripts/so2-metrics-cli.ts profile --project ../daedalus-corpus/ghostfolio-test/apps/api \
  --spec corpus/specs/ghostfolio-test.yaml --project-id ghostfolio-test --out results/latency-gate/so2/profile-ghostfolio-test --reps 3; \
  rmdir "$HOME/.daedalus-7693.lock"; }
```

The script ingests the project into the lane database, then runs `PROFILE` on the compiled FF-S02 template and on the universal cycle metric through a direct driver session (`resultAvailableAfter`, `resultConsumedAfter`, db hits, rows), one warm-up (repetition 0) and `--reps` measured repetitions, with the cap flags (`MAX_CYCLE_LENGTH` 10, `CYCLE_ROW_CAP` 100, truncation). It writes `profile.csv` and `scc_components.csv`. Credentials come only from the environment.

## 5. Cycle-strategy decision (ADR-016 e, applied mechanically)

- `gate.json` `pass` (both cycle queries within 30 s): `CYCLE_STRATEGY` stays `'cypher'` (`src/evaluation-engine/scc-cycles.ts`), U5a `simple-cycles` stays aligned (D-U5a-14).
- `fallback-required`: flip both to the Tarjan SCC fallback (`CYCLE_STRATEGY = 'scc'`), as an attributed snapshot step with its prereg bump (P-2).
- `inconclusive`: no decision; escalate.

## 6. NFR-07 latency table and long cycles

Repeat §4 on the other prepared corpus bases (`realworld-test`, `truthy-demo`, `dry-run-test`), each into `results/latency-gate/so2/profile-<projectId>/`. The NFR-07 table for public projects up to 300 files is `nfr07_latency.csv` from `npx tsx scripts/so2-metrics-cli.ts tables --run-dir results/latency-gate --run-dir results/apg-ablation --out results/latency-gate/so2-nfr07` (both plans are symbolic-only; the full-APG arm of `apg-ablation` holds the three in-scope bases, and the AST-only arm is left out of the table; ADR-021 item 8), plus the `profile.csv` rows. The H13 decision reads `results/latency-gate/so2/gate.json` only (§3), never this directory's `gate.json` or the aggregate's `gate_result` column. `scc_components.csv` flags every file-level component larger than 10 files as a possible undetected long cycle (threat to validity).

## 7. Structural coverage and the APG ablation (SO2; audit SO2-4, SO2-5, X-2, X-4)

```bash
npx tsx scripts/so2-metrics-cli.ts flows-to --plan experiments/apg-ablation/plan.json --out results/apg-ablation/so2  # extraction only, no database (results guard BR-U5b-56; ADR-024 item 2)
npx tsx scripts/so2-metrics-cli.ts arms --plan experiments/apg-ablation/plan.json --out results/apg-ablation/so2     # before the run: exit 1 if any base's arms are identical
npx tsx scripts/so2-metrics-cli.ts ablation --run-dir results/apg-ablation --out results/apg-ablation/so2            # after the apg-ablation plan run
```

Every `so2-metrics` extraction (`flows-to`, `arms`, `profile`) passes the evaluating spec's `default_exclude_paths`, read by the pipeline's rule (`readSpecExcludePaths`), so these files describe the graph each run evaluated (ADR-021 item 8). `graph_coverage.csv` (from `tables`) gives per run the node and edge counts by type and the data-flow edge coverage metric, FLOWS_TO edges per resolved internal import. `flows_to_stores.csv` gives the FLOWS_TO store accounting (stores, candidates, skips by reason, yield). The APG ablation runs `experiments/apg-ablation/plan.json` (each base twice; the `@ast-only` arm passes `--graph-mode ast-only`: the register's edge-type allow-list, IMPORTS, DECLARES and CONTAINS on the full extraction, with import resolution kept; ADR-021 item 8). `apg_arms.csv` (from `arms`, extraction only) gives per base the edges removed by type and confirms the arms differ; `apg_ablation.csv` lists per function the violation counts of both arms and the detection change.
