# H13 latency gate, PROFILE rows and long-cycle check (Build and Test BT-D, Steps 22–25)

> **Status**: measured 2026-10-09 on the Build and Test lane database (`bolt://localhost:7693`, `daedalus-neo4j-bt`), under the lane lock, at a 1-minute load average of about 2.4. Gate run at `f3fe474` (environment record `gitCommit`). PROFILE rows by `so2-metrics` as of `0c6a0de`, which is unchanged since. These are development measurements for the H13 gate and for NFR-07. They are not thesis results.

## 1. Registered latency-gate run (Step 22)

`run-experiment-cli.ts experiments/latency-gate/plan.json --neo4j-container daedalus-neo4j-bt` (prereg v4), then `so2-metrics-cli.ts tables --run-dir results/latency-gate --out results/latency-gate/so2`.

| Base | Status | Files | Total (ms) | FF-S02 (ms) | Universal cycle metric (ms) | Budget (ms) | `gate.json` |
|---|---|---|---|---|---|---|---|
| ghostfolio-test `apps/api` | accepted | 241 | 5 343 | 547 (ok) | 1 346 (ok) | 30 000 | **pass** ("both cycle queries within 30000 ms") |

The source is `results/latency-gate/so2/{latency.csv,gate.json}`, the only H13 gate source (runbook 1.2). An earlier run of the same plan wrote absolute clone paths into its report through extractor warnings. That run was discarded, `run-experiment` was fixed (`f3fe474`), and the plan was rerun from an empty output directory. The discarded run measured 613 / 1 366 ms.

## 2. PROFILE rows (Step 23 for ghostfolio; Step 25 for the other three bases)

Each base was profiled with `so2-metrics-cli.ts profile --project <path> --spec corpus/specs/<id>.yaml --project-id <id> --reps 3 --out results/latency-gate/so2/profile-<id>`: one warm-up, then three repetitions through a direct driver session. Caps: `MAX_CYCLE_LENGTH` 10, `CYCLE_ROW_CAP` 100. Repetition totals (available + consumed):

| Base | Query | Repetitions (ms) | db hits | Rows | Truncated | Timed out |
|---|---|---|---|---|---|---|
| ghostfolio-test | FF-S02 | 654, 594, 603 | 2 562 778 | 0 | no | no |
| ghostfolio-test | universal cycle metric | 1 415, 1 403, 1 396 | 5 087 372 | 1 | — | no |
| realworld-test | FF-S02 | 4, 4, 3 | 5 890 | 2 | no | no |
| realworld-test | universal cycle metric | 3, 2, 2 | 7 242 | 1 | — | no |
| truthy-demo | FF-S02 | 42, 44, 46 | 189 985 | 4 | no | no |
| truthy-demo | universal cycle metric | 84, 82, 81 | 238 640 | 1 | — | no |
| dry-run-test | FF-S02 | 57, 63, 64 | 248 333 | 0 | no | no |
| dry-run-test | universal cycle metric | 83, 94, 81 | 228 505 | 1 | — | no |

Credential check: the password count and the absolute-path count over `results/latency-gate/**` are both 0.

## 3. Cycle-strategy decision (Step 24, ADR-016 e)

The rule is applied mechanically. Both cycle queries complete well within 30 s on ghostfolio `apps/api`, the largest in-scope base (1.35 s in the gate run and 1.42 s at most in PROFILE), so **`CYCLE_STRATEGY` stays `'cypher'`**, and U5a `simple-cycles` stays aligned (D-U5a-14). There is **no flip, so no P-2 bump is needed**. P-2 stays reserved and unused. This outcome is named in the reason of the next bump. U3 H13 is closed (Step 48).

## 4. Long cycles (Step 25; BR-U1-28, BR-U1-31, threat 1)

Strongly connected file components, from `scc_components.csv` per base:

| Base | Components | Sizes | Any larger than 10 files |
|---|---|---|---|
| ghostfolio-test | 0 | — | no |
| realworld-test | 1 | 3 | no |
| truthy-demo | 3 | 4, 2, 2 | no |
| dry-run-test | 0 | — | no |

No component exceeds `MAX_CYCLE_LENGTH` 10, so on these four bases the bounded FF-S02 query cannot miss a cycle longer than 10 files. The threat stays open for bases not measured here: the E7 additions are profiled only if they enter the NFR-07 table.

## 5. NFR-07 table

`results/latency-gate/so2/nfr07_latency.csv` covers the one registered latency-gate run. The cycle-query timings of the other three bases are the PROFILE rows in §2. The runbook's combined table (1.6, with `results/apg-ablation`) is written when the APG ablation runs. It was not run here.
