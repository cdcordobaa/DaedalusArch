# Study 2 analysis determinism pack (A1 of the 2026-10-16 night backlog)

> **TOOLING, NOT A PRE-REGISTRATION.** This removes seed and analyst degrees of freedom from
> `scripts/v1.3/study2-analyse.ts`. It does not choose the primary scale, the confirmatory inference method or any
> other author decision. Every number in it comes from the **synthetic** rehearsal generator (#160). No sealed task is
> named, used or derived.

Built on `origin/v1.3-study2-analysis-rehearsal` (PR #160, not yet merged into `v1.3`).

## 1. Change list (committed before any number was computed)

All new behaviour is **OFF by default**. Without `--plan` and `--outcome`, `study2-analyse.ts` and
`study2-rehearsal.ts` write byte-identical output to #160 (checked by re-running the rehearsal into a scratch folder and
diffing it against `results/v1.3-study2-rehearsal/`).

1. **Analysis plan file** `scripts/v1.3/study2-analysis-plan.json` (tooling). It holds the Monte Carlo seed, the
   number of flips and resamples, the exact-enumeration bound (20 units), α, and two **empty author slots**:
   `primaryScale` (A3: `raw` | `perKloc`) and `confirmatoryInference` (A1: `sign-flip` | `bootstrap` | `both-agree`).
   Passed with `--plan <file>`. The seed comes from the file, never from the clock. `--seed` still exists; when it
   differs from the plan seed, every caption says `seed <n> (CLI override, not the plan seed)`.
2. **Exact sign-flip enumeration** when the number of units (blocks, or tasks at task level) is ≤ the plan bound
   (20; 2^20 sign vectors). Above the bound: Monte Carlo with a **dedicated** generator seeded from the plan seed and
   the contrast's fixed offset, so the p-value no longer depends on how many bootstrap draws ran first.
3. **One `inference` field per contrast**: test method (exact / Monte Carlo, flips, seed, seed source, Monte Carlo
   SE of p), bootstrap method (two-stage percentile, resamples, seed), and a `disagreement` flag set when the
   bootstrap CI excludes 0 but p > α, or p ≤ α but the CI includes 0. A `nearAlpha` flag marks a Monte Carlo p within
   3 Monte Carlo SE of α (the decision could change with the seed).
4. **Both scales side by side.** Under the blocking branch the confirmatory contrasts are computed on the raw slope
   and on the per-KLOC slope, each with its own Holm. The plan's `primaryScale` slot picks which is T2; while it is
   empty, T2 stays on the raw slope (the #160 status quo) and is labelled `primary slot UNFILLED (A3)`.
5. **`--outcome` columns** (OFF unless given; comma list): `blockingCount`, `blockingPerKloc`,
   `distinctViolatingEdges`, `newIdentitiesFromStep2`. Each gets the confirmatory contrasts in table T12, and the
   step-1 level per arm is reported separately.
   - `distinctViolatingEdges`: per step, the blocking count with FF-S01 and FF-S03 findings that share a file pair
     and direction (`filePath → target`) counted once (#161 §3.7.3: FF-S03 re-scores every upward edge FF-S01 already
     scores). Findings of other rules count as before. Dedup works on the listed findings only; steps whose listing
     is shorter than `blockingViolationCount` (a capped evaluator) are counted and reported.
   - `newIdentitiesFromStep2`: per run, the number of blocking identities first seen at step 2..k, with the memo §3
     identity (`scripts/lib/loop/pilot-metrics.ts` `runOutcomes`, rule + template + file + target; cycles by file
     set; earlier repair turns count as seen). Step-1 identities are the separate level column.
6. **Captions.** In plan mode every table carries one caption line: outcome, scale, inference method, seed.
7. **Rehearsal.** `study2-rehearsal.ts --plan <file>` re-runs the four scenarios and the 200-seed calibration for
   both inference methods and both scales, and adds the table "decision stability across 10 seeds".

## 2. Pass criterion (fixed before running)

| # | Criterion |
|---|---|
| P1 | With exact enumeration applicable (a contrast with ≤ 20 units), `study2-analyse.ts` p-values are identical across 10 runs with 10 different `--seed` values. Tested on the per-model contrasts (18 blocks) and the task-level tests (6 tasks) of the `expected` scenario, and in a unit test. |
| P2 | Above the bound, the seed is read from the plan file, and every table caption prints it. Two runs with the plan and no `--seed` are byte-identical. |
| P3 | 200-seed calibration under the `null` scenario: rejection rate ≤ 0.06 for **both** inference methods (Holm sign-flip; bootstrap CI excludes 0), on **both** scales (raw, per KLOC), for both confirmatory contrasts. |
| P4 | `distinctViolatingEdges` and `newIdentitiesFromStep2` are outcome columns available only with `--outcome`; unit tests show the FF-S01/FF-S03 dedup and the identity count on hand-made records. |
| P5 | The #160 rehearsal checks still pass 30/30, with and without `--plan`. |
| P6 | Without `--plan`/`--outcome` the rehearsal output is byte-identical to the committed `results/v1.3-study2-rehearsal/`. |

A failure of any line is reported as such in the PR; nothing is tuned after seeing it.

## 3. Results (synthetic data; seed 20261016; plan `scripts/v1.3/study2-analysis-plan.json`)

Reproduce:

```
npx tsx scripts/v1.3/study2-rehearsal.ts --data-root <scratch> --out results/v1.3-analysis-determinism --seed 20261016 \
  --calibration-sims 200 --power-sims 400 --plan scripts/v1.3/study2-analysis-plan.json \
  --outcome blockingCount,blockingPerKloc,distinctViolatingEdges,newIdentitiesFromStep2      # about 3 minutes
npx jest tests/unit/scripts/v1.3/study2-analysis-determinism.test.ts --maxWorkers=2             # 17 tests
```

Outputs: `results/v1.3-analysis-determinism/` (per-scenario `report.md`/`report.json`/`checks.json`/figures, and
`summary.md`/`summary.json` with the calibration per scale and method and the seed-stability tables).

| # | Result | Evidence |
|---|---|---|
| P1 | **PASS.** `study2-analyse.ts --plan` run 10 times on the `expected` out-root with `--seed` 20261016 + 7919·i (i = 0..9): the 6 per-model p-values (18 blocks each, exact) and the 2 task-level p-values (6 tasks, exact) are identical on all 10 runs (same SHA-1 of the p list). The seed-stability table in `summary.md` shows the same for `null` and `expected` over seeds 20261016..20261025. | `summary.md` "Decision stability"; unit test "per-model contrasts … identical p across seeds". |
| P2 | **PASS.** Two runs with the plan and no `--seed` are byte-identical (`diff -r`), and equal to a run with `--seed 20261016`. Every table has a caption line with outcome, scale, inference method and seed (unit test counts captions = tables). A CLI seed other than the plan's is printed as `CLI override, not the plan seed`. | Unit tests; `*/report.md`. |
| P3 | **PASS.** Under `null`, 200 studies: Holm sign-flip rejects 0.03 / 0.01 (raw, gate / mcp) and 0.03 / 0.04 (per KLOC); the bootstrap CI excludes 0 in 0.03 / 0.01 (raw) and 0.02 / 0.03 (per KLOC). All ≤ 0.06. Reported, not part of P3: the **unadjusted** sign-flip p ≤ α on raw `gate − none` is 0.07 (Monte Carlo SE ≈ 0.018 with 200 studies, so within about one SE of 0.05). | `summary.md` "Calibration per scale and inference method". |
| P4 | **PASS.** `distinctViolatingEdges` and `newIdentitiesFromStep2` appear only with `--outcome` (T12). Unit tests on hand-made records: an edge scored by FF-S01 and FF-S03 counts once; other rules and reversed edges are kept; a capped listing is flagged; identities first seen at step 2..k are counted with lines ignored. | Unit tests. |
| P5 | **PASS.** 30/30 rehearsal checks with `--plan` (`summary.md`), and 30/30 without. | `summary.md` in both result folders. |
| P6 | **PASS.** Without `--plan`, a fresh rehearsal run is byte-identical to the committed `results/v1.3-study2-rehearsal/` (`diff -r`, no output). | — |

What the numbers say (synthetic; exploratory; nothing here is a finding about agents):

1. **The `mcp` decision is still seed-dependent at 54 blocks, but the plan now fixes the seed.** Over 10 seeds the raw
   `daedalus-mcp − none` Holm p ranges 0.0463–0.0560 and rejects on 4 of 10 (#160 saw 3 of 8). With the plan seed it is
   0.0494 (reject), and the report flags it as within 3 Monte Carlo SE of α. Exact enumeration is impossible at 54
   blocks (2^54); raising `flips` (an author decision, A12) shrinks the band, it does not remove it.
2. **The two inference methods still disagree** on the `expected` data: the sign-flip test rejects both contrasts on
   the raw scale while both bootstrap CIs include 0 (flagged `DISAGREE`). Across 200 studies they disagree in 14 % (gate)
   and 11 % (mcp) on raw. Which one decides is the empty `confirmatoryInference` slot (A1).
3. **Raw and per-KLOC still give different answers** on the `expected` data (raw Holm p 0.008 / 0.049; per KLOC 0.215 /
   0.215), and under `expected` the per-KLOC power is about half the raw power (0.28 vs 0.59 for gate). The slot
   `primaryScale` (A3) is empty; T2 shows raw as a labelled placeholder.
4. **The synthetic generator emits no FF-S01/FF-S03 findings**, so `distinctViolatingEdges` equals the blocking count
   on these data (0 duplicates, 0 capped steps). Its dedup is tested only on hand-made records; the #161 snapshots would
   be the first real data (31 of 65 FF-S03 findings there duplicate an FF-S01 edge), and were not re-scored here.
5. `newIdentitiesFromStep2` drops runs with any unevaluated step (44 of 54 blocks in `expected`), because a finding
   could first appear on the unevaluated step. That rule is a choice taken under delegation and is listed in the PR.

## 4. Not done

- No author slot was filled; no A-item was decided (`study2-analysis-rehearsal.md` §5b marks which are now mechanical).
- No exact or normal-approximate rule at 54 blocks; flips stay at 9999.
- The #161 floor-probe snapshots were not re-scored with `distinctViolatingEdges` (needs a pass over its reports).
- The T1 switch rule still uses the rehearsal's identity (rule + file + target), not the memo identity (A7).
- No GLMM; no construct switch; nothing under the sealed directory was read; no LLM call.
