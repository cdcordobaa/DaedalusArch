# Study 2 analysis rehearsal: scenario floor (floor: zero blocking findings everywhere; expected effect on the advisory rules)

> **SYNTHETIC / DRY-RUN DATA.** At least one run says `dryRun: true`. Nothing below is a measurement.

> Study 2 analysis rehearsal output (`scripts/v1.3/study2-analyse.ts`). NOT A PRE-REGISTRATION.

Seed 20261016; 4999 bootstrap resamples; 9999 Monte Carlo sign flips (exact at ≤ 20 units); α = 0.05; a run's slope needs ≥ 3 steps with an outcome.

**Analysis plan** (`study2-analysis-plan/v0-tooling`, tooling, not a pre-registration): seed 20261016, 9999 flips, 4999 resamples, exact sign-flip at ≤ 20 units, α 0.05. Seed used: 20261016 (the plan seed). Author slots: primary scale **UNFILLED (A3)**; confirmatory inference **UNFILLED (A1)**.

## T0. Design as found

*Outcome: n/a (design) · scale: n/a · inference: none · seed 20261016 (plan).*

Runs 162; blocks 54; tasks 6; models claude-code-cli/synth-model-a, claude-code-cli/synth-model-b, codex-cli/synth-model-c; k ∈ {5}; arms none, daedalus-mcp, gate.

## T1. Pre-committed switch rule (pilot memo §3, §5)

*Outcome: new blocking identities after step 1 (pilot `none` arm) · scale: raw · inference: none (a count rule) · seed 20261016 (plan).*

Pilot memo §3: the primary outcome is ZERO (no new blocking finding after step 1 in any of 3 tasks). Per memo §5 the PRE-COMMITTED FALLBACK applies: the Study 2 primary outcome moves to the advisory-tier erosion rate (per-run slope of advisory findings per KLOC, FF-CV05 excluded).

| Pilot task | New blocking findings after step 1 (`none`) | Of which unlabelled | Excluded by label |
|---|---|---|---|
| synth-pilot-task-1 | 0 | 0 | 0 |
| synth-pilot-task-2 | 0 | 0 | 0 |
| synth-pilot-task-3 | 0 | 0 | 0 |

**Provisional:** the memo counts a new finding only when `check-correct.ts` labels it `correct` (or the author confirms a `not-checkable` one). No label file was given, so every new finding was counted.

**Fallback triggered:** YES. **Primary outcome:** Advisory violations per KLOC (FF-CV05 excluded), slope per step. **Memo definition met on these records:** yes.

- Under the advisory branch the `gate` arm still shows blocking findings only; whether `gate` gets the advisory subset or is dropped is undecided (memo §5, readiness gate D11b). The gate contrast is computed as designed and must be read with that caveat.

Floor check (descriptive, cannot change the primary outcome): 0 of 270 `none` steps have a blocking finding; every Study 2 step zero: yes.

## T2. Primary outcome: confirmatory contrasts (Holm over the two)

*Outcome: Advisory violations per KLOC (FF-CV05 excluded), slope per step · scale: perKloc · inference: Monte Carlo sign-flip (9999 flips) + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

Outcome: Advisory violations per KLOC (FF-CV05 excluded), slope per step. Per run, OLS slope on step 1..k; per block, arm − none; two-sided sign-flip test of the mean.

| Contrast | Blocks | Tasks | Mean slope arm | Mean slope ref | Mean diff | 95% CI (2-stage cluster bootstrap) | d_z | Relative reduction [95% CI] | Sign-flip p | Holm p | Reject at α |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gate − none | 54 | 6 | 0.564 | 0.391 | 0.173 | [-0.547, 0.851] | 0.07 | -0.44 [-11.50, 0.80] | 0.5956 | 1.0000 | no |
| daedalus-mcp − none | 54 | 6 | 0.424 | 0.391 | 0.033 | [-0.896, 0.790] | 0.01 | -0.08 [-12.24, 1.48] | 0.9277 | 1.0000 | no |

**Decision rule (A1):** UNFILLED (author decision). Both decisions are shown below; neither is named confirmatory. The "Reject at α" column above is the sign-flip Holm decision, kept from the rehearsal as a placeholder.

### T2a. Inference per confirmatory contrast

*Outcome: Advisory violations per KLOC (FF-CV05 excluded), slope per step · scale: perKloc · inference: Monte Carlo sign-flip (9999 flips) + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

| Contrast | Outcome | Units | Test | Test seed | p | MC SE of p | p near a Holm threshold | Bootstrap (resamples, seed) | CI excludes 0 | p ≤ α | Disagreement |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gate − none | Advisory violations per KLOC (FF-CV05 excluded), slope per step | 54 | Monte Carlo sign-flip | 20361026 | 0.5956 | 0.0049 | no | 4999, 20261026 | no | no | no |
| daedalus-mcp − none | Advisory violations per KLOC (FF-CV05 excluded), slope per step | 54 | Monte Carlo sign-flip | 20361027 | 0.9277 | 0.0026 | no | 4999, 20261027 | no | no | no |

α = 0.05. "Near a Holm threshold": a Monte Carlo p within 3 SE of α or α/2.

## T3. Task-level effects (forest plot F2) and the task-level test

*Outcome: Advisory violations per KLOC (FF-CV05 excluded), slope per step · scale: perKloc · inference: exact sign-flip over task means + per-task block bootstrap (≤ 1999 resamples) · seed 20261016 (plan).*

| Contrast | Task | Blocks | Mean diff | 95% CI (blocks within task) |
|---|---|---|---|---|
| gate − none | synth-task-1 | 9 | 0.511 | [-0.941, 1.947] |
| gate − none | synth-task-2 | 9 | -0.576 | [-2.881, 1.411] |
| gate − none | synth-task-3 | 9 | 0.476 | [-1.618, 2.755] |
| gate − none | synth-task-4 | 9 | 0.104 | [-0.405, 0.583] |
| gate − none | synth-task-5 | 9 | -0.037 | [-1.261, 1.181] |
| gate − none | synth-task-6 | 9 | 0.563 | [-0.309, 1.461] |
| daedalus-mcp − none | synth-task-1 | 9 | 0.374 | [-0.638, 1.700] |
| daedalus-mcp − none | synth-task-2 | 9 | -0.616 | [-2.514, 1.107] |
| daedalus-mcp − none | synth-task-3 | 9 | -0.855 | [-3.437, 2.233] |
| daedalus-mcp − none | synth-task-4 | 9 | 0.026 | [-0.595, 0.711] |
| daedalus-mcp − none | synth-task-5 | 9 | -0.022 | [-0.993, 0.957] |
| daedalus-mcp − none | synth-task-6 | 9 | 1.291 | [-0.049, 2.553] |

| Contrast | Task-level sign-flip p | Smallest attainable p | Tasks agreeing in sign |
|---|---|---|---|
| gate − none | 0.4063 | 0.0313 | 2 of 6 below 0 |
| daedalus-mcp − none | 0.9375 | 0.0313 | 3 of 6 below 0 |

## T4. Secondary contrast on the primary outcome (unadjusted)

*Outcome: Advisory violations per KLOC (FF-CV05 excluded), slope per step · scale: perKloc · inference: Monte Carlo sign-flip (9999 flips) + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

| Contrast | Outcome | Blocks | Mean arm | Mean ref | Mean diff | 95% CI | d_z | Relative reduction [95% CI] | Unadjusted p |
|---|---|---|---|---|---|---|---|---|---|
| gate − daedalus-mcp | Advisory violations per KLOC (FF-CV05 excluded), slope per step | 54 | 0.564 | 0.424 | 0.140 | [-0.504, 0.955] | 0.07 | -0.33 [-12.29, 0.71] | 0.6234 |

## T5. Primary outcome by model (model is a fixed factor; descriptive)

*Outcome: Advisory violations per KLOC (FF-CV05 excluded), slope per step · scale: perKloc · inference: exact sign-flip + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

| Model | Contrast | Blocks | Mean diff | 95% CI | Relative reduction | Sign-flip p | Test |
|---|---|---|---|---|---|---|---|
| claude-code-cli/synth-model-a | gate − none | 18 | -0.208 | [-2.200, 1.568] | 0.30 | 0.8047 | exact sign-flip |
| claude-code-cli/synth-model-a | daedalus-mcp − none | 18 | -0.414 | [-2.490, 1.715] | 0.59 | 0.5846 | exact sign-flip |
| claude-code-cli/synth-model-b | gate − none | 18 | 0.258 | [-0.726, 1.313] | -0.76 | 0.5973 | exact sign-flip |
| claude-code-cli/synth-model-b | daedalus-mcp − none | 18 | 0.349 | [-1.038, 2.259] | -1.03 | 0.6261 | exact sign-flip |
| codex-cli/synth-model-c | gate − none | 18 | 0.469 | [-0.089, 1.181] | -3.59 | 0.0857 | exact sign-flip |
| codex-cli/synth-model-c | daedalus-mcp − none | 18 | 0.165 | [-1.051, 1.123] | -1.26 | 0.7120 | exact sign-flip |

## T6. Secondary outcomes and guards (exploratory, unadjusted)

*Outcome: per row (column Outcome) · scale: per row (per KLOC where the outcome says so, else raw) · inference: Monte Carlo sign-flip (9999 flips) + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

| Contrast | Outcome | Blocks | Mean arm | Mean ref | Mean diff | 95% CI | d_z | Relative reduction [95% CI] | Unadjusted p |
|---|---|---|---|---|---|---|---|---|---|
| gate − none | Erosion slope: blocking violations per step | 54 | 0.000 | 0.000 | 0.000 | [0.000, 0.000] | n/a | n/a n/a | 1.0000 |
| daedalus-mcp − none | Erosion slope: blocking violations per step | 54 | 0.000 | 0.000 | 0.000 | [0.000, 0.000] | n/a | n/a n/a | 1.0000 |
| gate − none | Erosion slope: blocking violations per KLOC, per step | 54 | 0.000 | 0.000 | 0.000 | [0.000, 0.000] | n/a | n/a n/a | 1.0000 |
| daedalus-mcp − none | Erosion slope: blocking violations per KLOC, per step | 54 | 0.000 | 0.000 | 0.000 | [0.000, 0.000] | n/a | n/a n/a | 1.0000 |
| gate − none | Advisory violations per KLOC (all advisory rules, FF-CV05 INCLUDED), slope per step | 54 | 0.473 | 0.231 | 0.242 | [-0.872, 1.381] | 0.08 | -1.05 [-25.33, 3.04] | 0.5481 |
| daedalus-mcp − none | Advisory violations per KLOC (all advisory rules, FF-CV05 INCLUDED), slope per step | 54 | 0.041 | 0.231 | -0.190 | [-1.287, 1.125] | -0.06 | 0.82 [-6.68, 8.43] | 0.6781 |
| gate − none | AHS (v1.2E symbolic) at step k | 51 | 0.728 | 0.747 | -0.018 | [-0.064, 0.023] | -0.16 | 0.02 [-0.03, 0.09] | 0.2489 |
| daedalus-mcp − none | AHS (v1.2E symbolic) at step k | 53 | 0.737 | 0.745 | -0.009 | [-0.057, 0.037] | -0.06 | 0.01 [-0.05, 0.08] | 0.6403 |
| gate − none | AHS slope per step | 54 | -0.047 | -0.046 | -0.002 | [-0.012, 0.008] | -0.07 | n/a n/a | 0.5896 |
| daedalus-mcp − none | AHS slope per step | 54 | -0.047 | -0.046 | -0.001 | [-0.012, 0.008] | -0.05 | n/a n/a | 0.7207 |
| gate − none | AHS area under the curve (trapezoid, per step) | 54 | 0.833 | 0.836 | -0.003 | [-0.027, 0.020] | -0.05 | 0.00 [-0.02, 0.03] | 0.7126 |
| daedalus-mcp − none | AHS area under the curve (trapezoid, per step) | 54 | 0.827 | 0.836 | -0.009 | [-0.034, 0.017] | -0.12 | 0.01 [-0.02, 0.04] | 0.3707 |
| gate − none | Blocking-only AHS at step k | 51 | 1.000 | 1.000 | 0.000 | [0.000, 0.000] | n/a | 0.00 [0.00, 0.00] | 1.0000 |
| daedalus-mcp − none | Blocking-only AHS at step k | 53 | 1.000 | 1.000 | 0.000 | [0.000, 0.000] | n/a | 0.00 [0.00, 0.00] | 1.0000 |
| gate − none | Blocking-only AHS slope per step | 54 | 0.000 | 0.000 | 0.000 | [0.000, 0.000] | n/a | n/a n/a | 1.0000 |
| daedalus-mcp − none | Blocking-only AHS slope per step | 54 | 0.000 | 0.000 | 0.000 | [0.000, 0.000] | n/a | n/a n/a | 1.0000 |
| gate − none | Blocking-only AHS area under the curve (trapezoid, per step) | 54 | 1.000 | 1.000 | 0.000 | [0.000, 0.000] | n/a | 0.00 [0.00, 0.00] | 1.0000 |
| daedalus-mcp − none | Blocking-only AHS area under the curve (trapezoid, per step) | 54 | 1.000 | 1.000 | 0.000 | [0.000, 0.000] | n/a | 0.00 [0.00, 0.00] | 1.0000 |
| gate − none | LOC at step k (guard: feature dropping) | 54 | 2009.389 | 1996.019 | 13.370 | [-250.482, 288.172] | 0.02 | -0.01 [-0.16, 0.12] | 0.8932 |
| daedalus-mcp − none | LOC at step k (guard: feature dropping) | 54 | 2012.185 | 1996.019 | 16.167 | [-239.821, 278.044] | 0.02 | -0.01 [-0.15, 0.11] | 0.8781 |
| gate − none | Source files at step k (guard: feature dropping) | 54 | 57.426 | 57.037 | 0.389 | [-7.372, 8.185] | 0.02 | -0.01 [-0.16, 0.12] | 0.8954 |
| daedalus-mcp − none | Source files at step k (guard: feature dropping) | 54 | 57.481 | 57.037 | 0.444 | [-7.057, 8.020] | 0.02 | -0.01 [-0.17, 0.12] | 0.8851 |
| gate − none | Type-check errors per step (guard) | 54 | 0.189 | 0.133 | 0.056 | [-0.026, 0.137] | 0.22 | -0.42 [-1.39, 0.14] | 0.1444 |
| daedalus-mcp − none | Type-check errors per step (guard) | 54 | 0.189 | 0.133 | 0.056 | [-0.033, 0.144] | 0.22 | -0.42 [-1.57, 0.18] | 0.1448 |

## T7. Gate repair success (descriptive)

*Outcome: repair cleared the step; blocking before − after · scale: raw · inference: Wilson + task-cluster bootstrap (≤ 1999 resamples, seed + 900) · seed 20261016 (plan).*

| Gate steps | Failing steps (repair ran) | Repairs with an evaluated outcome | Cleared | Share cleared [Wilson 95%] | Share cleared [task-cluster 95%] | Mean blocking before − after [95%] | Findings introduced by repairs | Repair evaluation failed |
|---|---|---|---|---|---|---|---|---|
| 270 | 0 | 0 | 0 | n/a n/a | n/a | n/a | 0 | 0 |

## T8. Cost and time (descriptive, task-cluster bootstrap 95%)

*Outcome: cost, tokens, time, turns · scale: per step and per run · inference: task-cluster bootstrap (≤ 1999 resamples, seed + 700) · seed 20261016 (plan).*

| Arm | Steps | Steps with a cost | USD per step | USD per run (runs with every cost) | Input tokens per step | Output tokens per step | Wall minutes per step | Agent turns per step | Repair turns | Repair USD | Usage-limit interruptions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| none | 270 | 180 | 3.21 [2.96, 3.49] | 16.03 [14.89, 17.13] | 64235 [60923, 67707] | 10466 [9870, 11127] | 4.3 [4.0, 4.7] | 15.1 [14.5, 15.7] | 0 | 0.00 | 0 |
| daedalus-mcp | 270 | 180 | 3.22 [3.03, 3.41] | 16.12 [15.32, 16.92] | 63293 [60147, 66847] | 9907 [9350, 10501] | 4.3 [4.1, 4.6] | 15.1 [14.5, 15.7] | 0 | 0.00 | 0 |
| gate | 270 | 180 | 3.32 [3.03, 3.61] | 16.59 [15.13, 18.05] | 63313 [60424, 66429] | 9818 [9206, 10452] | 4.2 [4.0, 4.5] | 15.0 [14.5, 15.5] | 0 | 0.00 | 0 |

## T9. Guards (descriptive)

*Outcome: guards (evaluation errors, type-check, skeleton, LOC, files) · scale: raw · inference: none (counts and means) · seed 20261016 (plan).*

| Arm | Steps | Evaluation errors | Steps with type-check errors | Mean type-check errors | Skeleton broken | Non-completed turns | Mean LOC step 1 | Mean LOC step k | Mean files step k | Runs with a LOC drop |
|---|---|---|---|---|---|---|---|---|---|---|
| none | 270 | 2 | 35 | 0.13 | 1 | 12 | 599 | 1996 | 57.0 | 0 |
| daedalus-mcp | 270 | 4 | 47 | 0.19 | 1 | 10 | 604 | 2012 | 57.5 | 0 |
| gate | 270 | 3 | 49 | 0.19 | 1 | 8 | 603 | 2009 | 57.4 | 0 |

## T10. Missingness per model and arm

*Outcome: missingness · scale: raw · inference: none (counts) · seed 20261016 (plan).*

| Model | Arm | Runs scheduled | Runs found | Runs complete | Steps expected | Steps recorded | Steps without outcome | Runs without a slope |
|---|---|---|---|---|---|---|---|---|
| claude-code-cli/synth-model-a | none | 18 | 18 | 18 | 90 | 90 | 0 | 0 |
| claude-code-cli/synth-model-a | daedalus-mcp | 18 | 18 | 18 | 90 | 90 | 0 | 0 |
| claude-code-cli/synth-model-a | gate | 18 | 18 | 18 | 90 | 90 | 1 | 0 |
| claude-code-cli/synth-model-b | none | 18 | 18 | 18 | 90 | 90 | 0 | 0 |
| claude-code-cli/synth-model-b | daedalus-mcp | 18 | 18 | 18 | 90 | 90 | 2 | 0 |
| claude-code-cli/synth-model-b | gate | 18 | 18 | 18 | 90 | 90 | 2 | 0 |
| codex-cli/synth-model-c | none | 18 | 18 | 18 | 90 | 90 | 2 | 0 |
| codex-cli/synth-model-c | daedalus-mcp | 18 | 18 | 18 | 90 | 90 | 2 | 0 |
| codex-cli/synth-model-c | gate | 18 | 18 | 18 | 90 | 90 | 0 | 0 |

## T11. Trajectories (figure F1): mean per arm and step [normal 95%]

*Outcome: Advisory violations per KLOC (FF-CV05 excluded), slope per step; blocking; AHS (per step) · scale: perKloc · inference: normal 95% interval (no resampling) · seed 20261016 (plan).*

| Arm | Step | n | Primary outcome per step | Blocking per step | AHS |
|---|---|---|---|---|---|
| none | 1 | 53 | 4.903 [3.416, 6.391] | 0.000 | 0.925 |
| none | 2 | 54 | 6.297 [4.369, 8.225] | 0.000 | 0.881 |
| none | 3 | 54 | 5.282 [3.867, 6.696] | 0.000 | 0.843 |
| none | 4 | 53 | 6.236 [4.799, 7.672] | 0.000 | 0.787 |
| none | 5 | 54 | 6.842 [4.979, 8.705] | 0.000 | 0.744 |
| daedalus-mcp | 1 | 52 | 5.817 [3.508, 8.126] | 0.000 | 0.921 |
| daedalus-mcp | 2 | 53 | 5.587 [3.821, 7.353] | 0.000 | 0.877 |
| daedalus-mcp | 3 | 54 | 6.875 [4.289, 9.461] | 0.000 | 0.822 |
| daedalus-mcp | 4 | 54 | 7.417 [5.340, 9.494] | 0.000 | 0.780 |
| daedalus-mcp | 5 | 53 | 7.077 [5.262, 8.893] | 0.000 | 0.737 |
| gate | 1 | 54 | 4.915 [3.385, 6.445] | 0.000 | 0.926 |
| gate | 2 | 54 | 5.550 [4.192, 6.908] | 0.000 | 0.877 |
| gate | 3 | 54 | 6.419 [4.326, 8.512] | 0.000 | 0.833 |
| gate | 4 | 54 | 5.878 [4.348, 7.409] | 0.000 | 0.788 |
| gate | 5 | 51 | 7.829 [5.475, 10.183] | 0.000 | 0.728 |

## T12. Outcome columns (`--outcome`; exploratory unless the author names one primary)

An outcome T2 or T2b already computed reuses those contrasts (same seeds). For `newIdentitiesFromStep2` the "Mean slope" columns hold the mean per-run count.

### blockingCount

*Outcome: Erosion slope: blocking violations per step · scale: raw · inference: Monte Carlo sign-flip (9999 flips) + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

| Contrast | Blocks | Tasks | Mean slope arm | Mean slope ref | Mean diff | 95% CI (2-stage cluster bootstrap) | d_z | Relative reduction [95% CI] | Sign-flip p | Holm p | Reject at α |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gate − none | 54 | 6 | 0.000 | 0.000 | 0.000 | [0.000, 0.000] | n/a | n/a n/a | 1.0000 | 1.0000 | no |
| daedalus-mcp − none | 54 | 6 | 0.000 | 0.000 | 0.000 | [0.000, 0.000] | n/a | n/a n/a | 1.0000 | 1.0000 | no |

| Arm | Step-1 level (reported apart) [task-cluster 95%] | Runs |
|---|---|---|
| none | 0.00 [0.00, 0.00] | 53 |
| daedalus-mcp | 0.00 [0.00, 0.00] | 52 |
| gate | 0.00 [0.00, 0.00] | 54 |

### blockingPerKloc

*Outcome: Erosion slope: blocking violations per KLOC, per step · scale: perKloc · inference: Monte Carlo sign-flip (9999 flips) + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

| Contrast | Blocks | Tasks | Mean slope arm | Mean slope ref | Mean diff | 95% CI (2-stage cluster bootstrap) | d_z | Relative reduction [95% CI] | Sign-flip p | Holm p | Reject at α |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gate − none | 54 | 6 | 0.000 | 0.000 | 0.000 | [0.000, 0.000] | n/a | n/a n/a | 1.0000 | 1.0000 | no |
| daedalus-mcp − none | 54 | 6 | 0.000 | 0.000 | 0.000 | [0.000, 0.000] | n/a | n/a n/a | 1.0000 | 1.0000 | no |

| Arm | Step-1 level (reported apart) [task-cluster 95%] | Runs |
|---|---|---|
| none | 0.00 [0.00, 0.00] | 53 |
| daedalus-mcp | 0.00 [0.00, 0.00] | 52 |
| gate | 0.00 [0.00, 0.00] | 54 |

### distinctViolatingEdges

*Outcome: Erosion slope: distinct violating edges per step (FF-S01/FF-S03 deduplicated) · scale: raw · inference: Monte Carlo sign-flip (9999 flips) + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

| Contrast | Blocks | Tasks | Mean slope arm | Mean slope ref | Mean diff | 95% CI (2-stage cluster bootstrap) | d_z | Relative reduction [95% CI] | Sign-flip p | Holm p | Reject at α |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gate − none | 54 | 6 | 0.000 | 0.000 | 0.000 | [0.000, 0.000] | n/a | n/a n/a | 1.0000 | 1.0000 | no |
| daedalus-mcp − none | 54 | 6 | 0.000 | 0.000 | 0.000 | [0.000, 0.000] | n/a | n/a n/a | 1.0000 | 1.0000 | no |

| Arm | Step-1 level (reported apart) [task-cluster 95%] | Runs |
|---|---|---|
| none | 0.00 [0.00, 0.00] | 53 |
| daedalus-mcp | 0.00 [0.00, 0.00] | 52 |
| gate | 0.00 [0.00, 0.00] | 54 |

- Duplicates removed (same file pair and direction across FF-S01/FF-S03): none.
- Steps whose listed findings are fewer than their blocking count (capped listing; dedup partial): 0 of 810.

### newIdentitiesFromStep2

*Outcome: Blocking identities first seen at step 2..k, per run (memo §3 identity) · scale: raw · inference: Monte Carlo sign-flip (9999 flips) + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

| Contrast | Blocks | Tasks | Mean slope arm | Mean slope ref | Mean diff | 95% CI (2-stage cluster bootstrap) | d_z | Relative reduction [95% CI] | Sign-flip p | Holm p | Reject at α |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gate − none | 50 | 6 | 0.000 | 0.000 | 0.000 | [0.000, 0.000] | n/a | n/a n/a | 1.0000 | 1.0000 | no |
| daedalus-mcp − none | 50 | 6 | 0.000 | 0.000 | 0.000 | [0.000, 0.000] | n/a | n/a n/a | 1.0000 | 1.0000 | no |

| Arm | Step-1 level (reported apart) [task-cluster 95%] | Runs |
|---|---|---|
| none | 0.00 [0.00, 0.00] | 53 |
| daedalus-mcp | 0.00 [0.00, 0.00] | 52 |
| gate | 0.00 [0.00, 0.00] | 54 |

- Per-run count, not a slope: blocking identities (rule, template, file, target; cycles by file set) first seen at step 2..k, earlier repair turns counting as seen (`scripts/lib/loop/pilot-metrics.ts`). A run with an unevaluated step has no value. Step-1 level = distinct identities at step 1. No `check-correct` labels are applied.

## Not computable from the step records

*Outcome: n/a (list of missing outcomes) · scale: n/a · inference: none · seed 20261016 (plan).*

| Item | Why |
|---|---|
| GLMM (outline §5 candidate 2) | Not implemented: the outline leaves the choice between candidates 1 and 2 to registration, and a negative-binomial GLMM with crossed random slopes needs an R/Python fit outside this TypeScript toolchain. Listed as an open decision (rehearsal doc §5). |
| Held-out rule violations (Q4) | Not in the step record. `holdout-run.ts` (PR #119) scores the hold-out REFERENCE set for the validity gate, not loop snapshots; a held-out-rule score per snapshot needs a re-scoring pass over the kept commits. |
| Dependency-cruiser violations (Q4) | Not in the step record; needs the ADR-030 translation run over every snapshot commit. |
| Layer-coverage share, dynamic imports, barrels (gaming guards) | Not in the step record (`sourceFiles` lists files but not their layer match); readiness gate D13. |
| MCP tool calls per step, first call before or after the first write (process) | The call log is not part of the step record (readiness gate D6). |
| Per-step acceptance checks (feature completeness) | Not adopted yet (outline §4); only LOC and file trajectories are reported. |
| Judge dimensions FF-N01, FF-N02 | Scored offline after the runs (memo §4); not in the step record. |

Figures: `F1-trajectory.svg` (primary outcome per step and arm), `F2-forest-<contrast>.svg` (task-level effects).
