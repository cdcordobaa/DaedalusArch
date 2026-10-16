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

## 3. Results

(filled after the run, below this line)
