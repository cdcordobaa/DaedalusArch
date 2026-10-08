# Performance Test Instructions — DaedalusArch v1.2E

> **Supersedes** the v1.0 performance-test instructions (US-NFR-2 targets). The earlier text stays in git history.
> **Cycle**: v1.2 Evaluation-Readiness, Build and Test (plan Steps 11, 21–25). **Date**: 2026-10-08.

## 1. Targets

| Requirement | Target | Where measured |
|---|---|---|
| NFR-v1.2E-03 | Under 5 000 ms per fixture project (extract + ingest + evaluate, symbolic-only) after Package nodes and edge properties were added | FR-18 result file `results/pre-tag/fixtures-<sha>.json` (Step 11) |
| NFR-v1.2E-07 | Every Cypher query has a timeout; the cycle search is bounded (`MAX_CYCLE_LENGTH` 10, `CYCLE_ROW_CAP` 100, `src/fitness-compiler/cypher-templates.ts`); a latency budget is stated for public projects up to 300 files | `Docs/DiagnosticRuns /bt-latency-profile.md` (Steps 23, 25) |
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
npx tsx scripts/run-experiment-cli.ts experiments/latency-gate/plan.json
# writes results/latency-gate/ (RunRecord, scrubbed report, EnvironmentRecord) and latency.csv
```

## 4. PROFILE capture (H13, NFR-07)

Ingest the project into the lane database, then run `PROFILE` on the FF-S02 template and on the universal cycle metric through a direct driver session (not `executeQuery`, which hides the summary), one warm-up and three repetitions:

```ts
const session = driver.session();
const res = await session.run('PROFILE ' + cypher, params);
const s = res.summary;
// record: s.profile db hits and rows (walk the plan tree), s.resultAvailableAfter, s.resultConsumedAfter,
// and the cap flags: cycle length bound 10, row cap 100, truncation warning (EVAL_003)
await session.close();
```

Record the rows in `Docs/DiagnosticRuns /bt-latency-profile.md`.

## 5. Cycle-strategy decision (ADR-016 e, applied mechanically)

- Both cycle queries within 30 s: `CYCLE_STRATEGY` stays `'cypher'` (`src/evaluation-engine/scc-cycles.ts`), U5a `simple-cycles` stays aligned (D-U5a-14).
- Otherwise: flip both to the Tarjan SCC fallback (`CYCLE_STRATEGY = 'scc'`), as an attributed snapshot step with its prereg bump (P-2).

## 6. NFR-07 latency table and long cycles

Repeat §4 on the other prepared corpus bases (`realworld-test`, `truthy-demo`, `dry-run-test`) and append the table for public projects up to 300 files. For each base, compare SCC component sizes with the bounded query's cycles; a component larger than 10 files is reported as a possible undetected long cycle (threat to validity).
