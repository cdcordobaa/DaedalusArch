# Study 2 analysis rehearsal: scenario null (no effect)

> **SYNTHETIC / DRY-RUN DATA.** At least one run says `dryRun: true`. Nothing below is a measurement.

> Study 2 analysis rehearsal output (`scripts/v1.3/study2-analyse.ts`). NOT A PRE-REGISTRATION.

Seed 20261016; 4999 bootstrap resamples; 9999 Monte Carlo sign flips (exact at ≤ 20 units); α = 0.05; a run's slope needs ≥ 3 steps with an outcome.

**Analysis plan** (`study2-analysis-plan/v0-tooling`, tooling, not a pre-registration): seed 20261016, 9999 flips, 4999 resamples, exact sign-flip at ≤ 20 units, α 0.05. Seed used: 20261016 (the plan seed). Author slots: primary scale **UNFILLED (A3)**; confirmatory inference **UNFILLED (A1)**.

## T0. Design as found

*Outcome: n/a (design) · scale: n/a · inference: none · seed 20261016 (plan).*

Runs 162; blocks 54; tasks 6; models claude-code-cli/synth-model-a, claude-code-cli/synth-model-b, codex-cli/synth-model-c; k ∈ {5}; arms none, daedalus-mcp, gate.

## T1. Pre-committed switch rule (pilot memo §3, §5)

*Outcome: new blocking identities after step 1 (pilot `none` arm) · scale: raw · inference: none (a count rule) · seed 20261016 (plan).*

Pilot memo §3: erosion EXISTS (new blocking findings after step 1 in 3 of 3 tasks). Per memo §5 the Study 2 primary outcome stays the blocking erosion slope.

| Pilot task | New blocking findings after step 1 (`none`) | Of which unlabelled | Excluded by label |
|---|---|---|---|
| synth-pilot-task-1 | 1 | 1 | 0 |
| synth-pilot-task-2 | 33 | 33 | 0 |
| synth-pilot-task-3 | 3 | 3 | 0 |

**Provisional:** the memo counts a new finding only when `check-correct.ts` labels it `correct` (or the author confirms a `not-checkable` one). No label file was given, so every new finding was counted.

**Fallback triggered:** no. **Primary outcome:** Erosion slope: blocking violations per step. **Memo definition met on these records:** yes.

- Primary scale slot UNFILLED (A3, author decision): T2 shows the raw slope as a placeholder; T2b shows both scales side by side, each with its own Holm.

Floor check (descriptive, cannot change the primary outcome): 193 of 270 `none` steps have a blocking finding; every Study 2 step zero: no.

## T2. Primary outcome: confirmatory contrasts (Holm over the two)

*Outcome: Erosion slope: blocking violations per step · scale: raw (placeholder: primary slot UNFILLED, A3) · inference: Monte Carlo sign-flip (9999 flips) + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

Outcome: Erosion slope: blocking violations per step. Per run, OLS slope on step 1..k; per block, arm − none; two-sided sign-flip test of the mean.

| Contrast | Blocks | Tasks | Mean slope arm | Mean slope ref | Mean diff | 95% CI (2-stage cluster bootstrap) | d_z | Relative reduction [95% CI] | Sign-flip p | Holm p | Reject at α |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gate − none | 54 | 6 | 0.824 | 0.719 | 0.105 | [-0.300, 0.534] | 0.08 | -0.15 [-0.95, 0.37] | 0.5637 | 1.0000 | no |
| daedalus-mcp − none | 54 | 6 | 0.680 | 0.719 | -0.039 | [-0.426, 0.341] | -0.03 | 0.05 [-0.70, 0.48] | 0.8291 | 1.0000 | no |

**Decision rule (A1):** UNFILLED (author decision). Both decisions are shown below; neither is named confirmatory. The "Reject at α" column above is the sign-flip Holm decision, kept from the rehearsal as a placeholder.

### T2a. Inference per confirmatory contrast

*Outcome: Erosion slope: blocking violations per step · scale: raw · inference: Monte Carlo sign-flip (9999 flips) + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

| Contrast | Outcome | Units | Test | Test seed | p | MC SE of p | p near a Holm threshold | Bootstrap (resamples, seed) | CI excludes 0 | p ≤ α | Disagreement |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gate − none | Erosion slope: blocking violations per step | 54 | Monte Carlo sign-flip | 20361026 | 0.5637 | 0.0050 | no | 4999, 20261026 | no | no | no |
| daedalus-mcp − none | Erosion slope: blocking violations per step | 54 | Monte Carlo sign-flip | 20361027 | 0.8291 | 0.0038 | no | 4999, 20261027 | no | no | no |

α = 0.05. "Near a Holm threshold": a Monte Carlo p within 3 SE of α or α/2.

### T2b. Both blocking scales side by side (each with its own Holm over the two contrasts)

*Outcome: blocking violations, erosion slope · scale: raw and perKloc · inference: Monte Carlo sign-flip (9999 flips) + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

| Scale | Contrast | Blocks | Mean diff | 95% CI | Sign-flip p | Holm p | Holm rejects | CI excludes 0 | Disagreement | T2 uses this scale |
|---|---|---|---|---|---|---|---|---|---|---|
| raw | gate − none | 54 | 0.105 | [-0.300, 0.534] | 0.5637 | 1.0000 | no | no | no | placeholder |
| raw | daedalus-mcp − none | 54 | -0.039 | [-0.426, 0.341] | 0.8291 | 1.0000 | no | no | no | placeholder |
| perKloc | gate − none | 54 | 0.068 | [-0.290, 0.413] | 0.5885 | 1.0000 | no | no | no | no |
| perKloc | daedalus-mcp − none | 54 | 0.022 | [-0.291, 0.313] | 0.8473 | 1.0000 | no | no | no | no |

## T3. Task-level effects (forest plot F2) and the task-level test

*Outcome: Erosion slope: blocking violations per step · scale: raw · inference: exact sign-flip over task means + per-task block bootstrap (≤ 1999 resamples) · seed 20261016 (plan).*

| Contrast | Task | Blocks | Mean diff | 95% CI (blocks within task) |
|---|---|---|---|---|
| gate − none | synth-task-1 | 9 | 0.178 | [-0.478, 0.700] |
| gate − none | synth-task-2 | 9 | 0.144 | [-0.600, 0.889] |
| gate − none | synth-task-3 | 9 | 0.367 | [-1.056, 1.767] |
| gate − none | synth-task-4 | 9 | 0.011 | [-0.344, 0.400] |
| gate − none | synth-task-5 | 9 | 0.419 | [-0.551, 1.401] |
| gate − none | synth-task-6 | 9 | -0.489 | [-1.000, 0.078] |
| daedalus-mcp − none | synth-task-1 | 9 | 0.422 | [-0.212, 1.200] |
| daedalus-mcp − none | synth-task-2 | 9 | -0.233 | [-1.501, 0.600] |
| daedalus-mcp − none | synth-task-3 | 9 | -0.144 | [-1.189, 0.756] |
| daedalus-mcp − none | synth-task-4 | 9 | 0.156 | [-0.144, 0.444] |
| daedalus-mcp − none | synth-task-5 | 9 | 0.078 | [-0.812, 0.978] |
| daedalus-mcp − none | synth-task-6 | 9 | -0.511 | [-0.878, -0.100] |

| Contrast | Task-level sign-flip p | Smallest attainable p | Tasks agreeing in sign |
|---|---|---|---|
| gate − none | 0.4063 | 0.0313 | 1 of 6 below 0 |
| daedalus-mcp − none | 0.8125 | 0.0313 | 3 of 6 below 0 |

## T4. Secondary contrast on the primary outcome (unadjusted)

*Outcome: Erosion slope: blocking violations per step · scale: raw · inference: Monte Carlo sign-flip (9999 flips) + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

| Contrast | Outcome | Blocks | Mean arm | Mean ref | Mean diff | 95% CI | d_z | Relative reduction [95% CI] | Unadjusted p |
|---|---|---|---|---|---|---|---|---|---|
| gate − daedalus-mcp | Erosion slope: blocking violations per step | 54 | 0.824 | 0.680 | 0.144 | [-0.199, 0.549] | 0.12 | -0.21 [-0.93, 0.27] | 0.3789 |

## T5. Primary outcome by model (model is a fixed factor; descriptive)

*Outcome: Erosion slope: blocking violations per step · scale: raw · inference: exact sign-flip + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

| Model | Contrast | Blocks | Mean diff | 95% CI | Relative reduction | Sign-flip p | Test |
|---|---|---|---|---|---|---|---|
| claude-code-cli/synth-model-a | gate − none | 18 | 0.022 | [-0.795, 0.839] | -0.02 | 0.9647 | exact sign-flip |
| claude-code-cli/synth-model-a | daedalus-mcp − none | 18 | 0.033 | [-0.961, 0.961] | -0.03 | 0.9516 | exact sign-flip |
| claude-code-cli/synth-model-b | gate − none | 18 | 0.143 | [-0.616, 1.084] | -0.28 | 0.7278 | exact sign-flip |
| claude-code-cli/synth-model-b | daedalus-mcp − none | 18 | -0.111 | [-0.600, 0.333] | 0.22 | 0.6170 | exact sign-flip |
| codex-cli/synth-model-c | gate − none | 18 | 0.150 | [-0.389, 0.683] | -0.36 | 0.5157 | exact sign-flip |
| codex-cli/synth-model-c | daedalus-mcp − none | 18 | -0.039 | [-0.367, 0.289] | 0.09 | 0.8291 | exact sign-flip |

## T6. Secondary outcomes and guards (exploratory, unadjusted)

*Outcome: per row (column Outcome) · scale: per row (per KLOC where the outcome says so, else raw) · inference: Monte Carlo sign-flip (9999 flips) + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

| Contrast | Outcome | Blocks | Mean arm | Mean ref | Mean diff | 95% CI | d_z | Relative reduction [95% CI] | Unadjusted p |
|---|---|---|---|---|---|---|---|---|---|
| gate − none | Erosion slope: blocking violations per KLOC, per step | 54 | 0.063 | -0.005 | 0.068 | [-0.290, 0.413] | 0.07 | n/a [-32.42, 13.46] | 0.5939 |
| daedalus-mcp − none | Erosion slope: blocking violations per KLOC, per step | 54 | 0.017 | -0.005 | 0.022 | [-0.291, 0.326] | 0.03 | n/a [-19.47, 17.74] | 0.8488 |
| gate − none | Advisory violations per KLOC (FF-CV05 excluded), slope per step | 54 | 0.650 | 0.714 | -0.064 | [-0.888, 0.788] | -0.03 | 0.09 [-1.99, 0.86] | 0.8566 |
| daedalus-mcp − none | Advisory violations per KLOC (FF-CV05 excluded), slope per step | 54 | 0.517 | 0.714 | -0.197 | [-0.750, 0.393] | -0.11 | 0.28 [-0.72, 1.17] | 0.4412 |
| gate − none | Advisory violations per KLOC (all advisory rules, FF-CV05 INCLUDED), slope per step | 54 | 0.351 | 1.060 | -0.709 | [-1.842, 0.374] | -0.20 | 0.67 [-0.50, 1.60] | 0.1540 |
| daedalus-mcp − none | Advisory violations per KLOC (all advisory rules, FF-CV05 INCLUDED), slope per step | 54 | 0.621 | 1.060 | -0.439 | [-1.656, 0.720] | -0.14 | 0.41 [-1.22, 1.43] | 0.3033 |
| gate − none | AHS (v1.2E symbolic) at step k | 52 | 0.560 | 0.577 | -0.017 | [-0.098, 0.064] | -0.06 | 0.03 [-0.11, 0.17] | 0.6573 |
| daedalus-mcp − none | AHS (v1.2E symbolic) at step k | 53 | 0.575 | 0.580 | -0.006 | [-0.089, 0.078] | -0.02 | 0.01 [-0.14, 0.15] | 0.8782 |
| gate − none | AHS slope per step | 54 | -0.079 | -0.078 | -0.001 | [-0.018, 0.016] | -0.01 | n/a n/a | 0.9303 |
| daedalus-mcp − none | AHS slope per step | 54 | -0.076 | -0.078 | 0.002 | [-0.016, 0.020] | 0.04 | n/a n/a | 0.7966 |
| gate − none | AHS area under the curve (trapezoid, per step) | 54 | 0.714 | 0.728 | -0.015 | [-0.079, 0.038] | -0.09 | 0.02 [-0.05, 0.10] | 0.5292 |
| daedalus-mcp − none | AHS area under the curve (trapezoid, per step) | 54 | 0.729 | 0.728 | 0.000 | [-0.052, 0.047] | 0.00 | -0.00 [-0.06, 0.07] | 0.9927 |
| gate − none | Blocking-only AHS at step k | 52 | 0.689 | 0.715 | -0.026 | [-0.141, 0.091] | -0.07 | 0.04 [-0.13, 0.19] | 0.6025 |
| daedalus-mcp − none | Blocking-only AHS at step k | 53 | 0.691 | 0.718 | -0.027 | [-0.138, 0.084] | -0.08 | 0.04 [-0.14, 0.20] | 0.5988 |
| gate − none | Blocking-only AHS slope per step | 54 | -0.058 | -0.051 | -0.007 | [-0.035, 0.020] | -0.09 | n/a n/a | 0.5258 |
| daedalus-mcp − none | Blocking-only AHS slope per step | 54 | -0.053 | -0.051 | -0.003 | [-0.030, 0.025] | -0.03 | n/a n/a | 0.8025 |
| gate − none | Blocking-only AHS area under the curve (trapezoid, per step) | 54 | 0.787 | 0.809 | -0.021 | [-0.104, 0.052] | -0.10 | 0.03 [-0.07, 0.13] | 0.4582 |
| daedalus-mcp − none | Blocking-only AHS area under the curve (trapezoid, per step) | 54 | 0.810 | 0.809 | 0.001 | [-0.075, 0.066] | 0.01 | -0.00 [-0.09, 0.09] | 0.9675 |
| gate − none | LOC at step k (guard: feature dropping) | 54 | 2054.000 | 2076.185 | -22.185 | [-245.614, 197.934] | -0.03 | 0.01 [-0.10, 0.12] | 0.8349 |
| daedalus-mcp − none | LOC at step k (guard: feature dropping) | 54 | 2091.667 | 2076.185 | 15.481 | [-275.375, 268.077] | 0.02 | -0.01 [-0.13, 0.13] | 0.8793 |
| gate − none | Source files at step k (guard: feature dropping) | 54 | 58.741 | 59.241 | -0.500 | [-6.870, 5.648] | -0.02 | 0.01 [-0.10, 0.11] | 0.8826 |
| daedalus-mcp − none | Source files at step k (guard: feature dropping) | 54 | 59.759 | 59.241 | 0.519 | [-8.859, 7.815] | 0.02 | -0.01 [-0.14, 0.14] | 0.8613 |
| gate − none | Type-check errors per step (guard) | 54 | 0.115 | 0.163 | -0.048 | [-0.130, 0.026] | -0.21 | 0.30 [-0.26, 0.63] | 0.1631 |
| daedalus-mcp − none | Type-check errors per step (guard) | 54 | 0.196 | 0.163 | 0.033 | [-0.059, 0.137] | 0.12 | -0.20 [-1.26, 0.28] | 0.4309 |

## T7. Gate repair success (descriptive)

*Outcome: repair cleared the step; blocking before − after · scale: raw · inference: Wilson + task-cluster bootstrap (≤ 1999 resamples, seed + 900) · seed 20261016 (plan).*

| Gate steps | Failing steps (repair ran) | Repairs with an evaluated outcome | Cleared | Share cleared [Wilson 95%] | Share cleared [task-cluster 95%] | Mean blocking before − after [95%] | Findings introduced by repairs | Repair evaluation failed |
|---|---|---|---|---|---|---|---|---|
| 270 | 234 | 232 | 51 | 0.22 [0.17, 0.28] | [0.14, 0.30] | 1.95 [1.77, 2.13] | 0 | 2 |

## T8. Cost and time (descriptive, task-cluster bootstrap 95%)

*Outcome: cost, tokens, time, turns · scale: per step and per run · inference: task-cluster bootstrap (≤ 1999 resamples, seed + 700) · seed 20261016 (plan).*

| Arm | Steps | Steps with a cost | USD per step | USD per run (runs with every cost) | Input tokens per step | Output tokens per step | Wall minutes per step | Agent turns per step | Repair turns | Repair USD | Usage-limit interruptions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| none | 270 | 180 | 3.30 [3.11, 3.51] | 16.50 [15.62, 17.34] | 62992 [59901, 66363] | 9829 [9213, 10458] | 4.3 [4.1, 4.6] | 15.0 [14.5, 15.5] | 0 | 0.00 | 0 |
| daedalus-mcp | 270 | 180 | 3.28 [3.07, 3.51] | 16.40 [15.43, 17.44] | 60707 [58222, 63450] | 9933 [9426, 10469] | 4.2 [3.8, 4.6] | 15.5 [15.0, 16.0] | 0 | 0.00 | 0 |
| gate | 270 | 180 | 4.27 [4.04, 4.53] | 21.37 [20.19, 22.56] | 86853 [83712, 89940] | 12312 [11714, 12945] | 5.6 [5.3, 6.0] | 20.1 [19.4, 20.8] | 234 | 218.48 | 0 |

## T9. Guards (descriptive)

*Outcome: guards (evaluation errors, type-check, skeleton, LOC, files) · scale: raw · inference: none (counts and means) · seed 20261016 (plan).*

| Arm | Steps | Evaluation errors | Steps with type-check errors | Mean type-check errors | Skeleton broken | Non-completed turns | Mean LOC step 1 | Mean LOC step k | Mean files step k | Runs with a LOC drop |
|---|---|---|---|---|---|---|---|---|---|---|
| none | 270 | 1 | 41 | 0.16 | 1 | 8 | 623 | 2076 | 59.2 | 0 |
| daedalus-mcp | 270 | 0 | 48 | 0.20 | 1 | 7 | 628 | 2092 | 59.8 | 0 |
| gate | 270 | 3 | 30 | 0.11 | 3 | 12 | 616 | 2054 | 58.7 | 0 |

## T10. Missingness per model and arm

*Outcome: missingness · scale: raw · inference: none (counts) · seed 20261016 (plan).*

| Model | Arm | Runs scheduled | Runs found | Runs complete | Steps expected | Steps recorded | Steps without outcome | Runs without a slope |
|---|---|---|---|---|---|---|---|---|
| claude-code-cli/synth-model-a | none | 18 | 18 | 18 | 90 | 90 | 1 | 0 |
| claude-code-cli/synth-model-a | daedalus-mcp | 18 | 18 | 18 | 90 | 90 | 0 | 0 |
| claude-code-cli/synth-model-a | gate | 18 | 18 | 18 | 90 | 90 | 0 | 0 |
| claude-code-cli/synth-model-b | none | 18 | 18 | 18 | 90 | 90 | 0 | 0 |
| claude-code-cli/synth-model-b | daedalus-mcp | 18 | 18 | 18 | 90 | 90 | 0 | 0 |
| claude-code-cli/synth-model-b | gate | 18 | 18 | 18 | 90 | 90 | 2 | 0 |
| codex-cli/synth-model-c | none | 18 | 18 | 18 | 90 | 90 | 0 | 0 |
| codex-cli/synth-model-c | daedalus-mcp | 18 | 18 | 18 | 90 | 90 | 0 | 0 |
| codex-cli/synth-model-c | gate | 18 | 18 | 18 | 90 | 90 | 1 | 0 |

## T11. Trajectories (figure F1): mean per arm and step [normal 95%]

*Outcome: Erosion slope: blocking violations per step; blocking; AHS (per step) · scale: raw · inference: normal 95% interval (no resampling) · seed 20261016 (plan).*

| Arm | Step | n | Primary outcome per step | Blocking per step | AHS |
|---|---|---|---|---|---|
| none | 1 | 54 | 1.241 [0.817, 1.665] | 1.241 | 0.878 |
| none | 2 | 54 | 1.500 [0.943, 2.057] | 1.500 | 0.821 |
| none | 3 | 54 | 2.722 [1.955, 3.490] | 2.722 | 0.715 |
| none | 4 | 54 | 3.333 [2.148, 4.518] | 3.333 | 0.646 |
| none | 5 | 53 | 3.792 [2.630, 4.954] | 3.792 | 0.580 |
| daedalus-mcp | 1 | 54 | 1.037 [0.588, 1.486] | 1.037 | 0.884 |
| daedalus-mcp | 2 | 54 | 1.981 [1.385, 2.578] | 1.981 | 0.797 |
| daedalus-mcp | 3 | 54 | 2.315 [1.511, 3.119] | 2.315 | 0.727 |
| daedalus-mcp | 4 | 54 | 2.889 [1.893, 3.885] | 2.889 | 0.662 |
| daedalus-mcp | 5 | 54 | 3.981 [3.045, 4.918] | 3.981 | 0.572 |
| gate | 1 | 54 | 1.037 [0.598, 1.477] | 1.037 | 0.879 |
| gate | 2 | 53 | 2.509 [1.138, 3.881] | 2.509 | 0.781 |
| gate | 3 | 54 | 2.981 [1.994, 3.969] | 2.981 | 0.712 |
| gate | 4 | 53 | 3.887 [2.528, 5.246] | 3.887 | 0.633 |
| gate | 5 | 53 | 4.396 [2.923, 5.869] | 4.396 | 0.562 |

## T12. Outcome columns (`--outcome`; exploratory unless the author names one primary)

An outcome T2 or T2b already computed reuses those contrasts (same seeds). For `newIdentitiesFromStep2` the "Mean slope" columns hold the mean per-run count.

### blockingCount

*Outcome: Erosion slope: blocking violations per step · scale: raw · inference: Monte Carlo sign-flip (9999 flips) + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

| Contrast | Blocks | Tasks | Mean slope arm | Mean slope ref | Mean diff | 95% CI (2-stage cluster bootstrap) | d_z | Relative reduction [95% CI] | Sign-flip p | Holm p | Reject at α |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gate − none | 54 | 6 | 0.824 | 0.719 | 0.105 | [-0.300, 0.534] | 0.08 | -0.15 [-0.95, 0.37] | 0.5637 | 1.0000 | no |
| daedalus-mcp − none | 54 | 6 | 0.680 | 0.719 | -0.039 | [-0.426, 0.341] | -0.03 | 0.05 [-0.70, 0.48] | 0.8291 | 1.0000 | no |

| Arm | Step-1 level (reported apart) [task-cluster 95%] | Runs |
|---|---|---|
| none | 1.24 [0.80, 1.80] | 54 |
| daedalus-mcp | 1.04 [0.54, 1.72] | 54 |
| gate | 1.04 [0.41, 1.80] | 54 |

### blockingPerKloc

*Outcome: Erosion slope: blocking violations per KLOC, per step · scale: perKloc · inference: Monte Carlo sign-flip (9999 flips) + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

| Contrast | Blocks | Tasks | Mean slope arm | Mean slope ref | Mean diff | 95% CI (2-stage cluster bootstrap) | d_z | Relative reduction [95% CI] | Sign-flip p | Holm p | Reject at α |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gate − none | 54 | 6 | 0.063 | -0.005 | 0.068 | [-0.290, 0.413] | 0.07 | n/a [-30.60, 11.05] | 0.5885 | 1.0000 | no |
| daedalus-mcp − none | 54 | 6 | 0.017 | -0.005 | 0.022 | [-0.291, 0.313] | 0.03 | n/a [-17.57, 17.27] | 0.8473 | 1.0000 | no |

| Arm | Step-1 level (reported apart) [task-cluster 95%] | Runs |
|---|---|---|
| none | 2.08 [1.40, 2.88] | 54 |
| daedalus-mcp | 1.72 [0.85, 2.74] | 54 |
| gate | 1.90 [0.66, 3.39] | 54 |

### distinctViolatingEdges

*Outcome: Erosion slope: distinct violating edges per step (FF-S01/FF-S03 deduplicated) · scale: raw · inference: Monte Carlo sign-flip (9999 flips) + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

| Contrast | Blocks | Tasks | Mean slope arm | Mean slope ref | Mean diff | 95% CI (2-stage cluster bootstrap) | d_z | Relative reduction [95% CI] | Sign-flip p | Holm p | Reject at α |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gate − none | 54 | 6 | 0.824 | 0.719 | 0.105 | [-0.284, 0.537] | 0.08 | -0.15 [-0.93, 0.36] | 0.5699 | 1.0000 | no |
| daedalus-mcp − none | 54 | 6 | 0.680 | 0.719 | -0.039 | [-0.454, 0.356] | -0.03 | 0.05 [-0.73, 0.46] | 0.8283 | 1.0000 | no |

| Arm | Step-1 level (reported apart) [task-cluster 95%] | Runs |
|---|---|---|
| none | 1.24 [0.81, 1.80] | 54 |
| daedalus-mcp | 1.04 [0.56, 1.74] | 54 |
| gate | 1.04 [0.39, 1.72] | 54 |

- Duplicates removed (same file pair and direction across FF-S01/FF-S03): none.
- Steps whose listed findings are fewer than their blocking count (capped listing; dedup partial): 0 of 810.

### newIdentitiesFromStep2

*Outcome: Blocking identities first seen at step 2..k, per run (memo §3 identity) · scale: raw · inference: Monte Carlo sign-flip (9999 flips) + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

| Contrast | Blocks | Tasks | Mean slope arm | Mean slope ref | Mean diff | 95% CI (2-stage cluster bootstrap) | d_z | Relative reduction [95% CI] | Sign-flip p | Holm p | Reject at α |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gate − none | 50 | 6 | 3.920 | 4.660 | -0.740 | [-2.735, 1.755] | -0.11 | 0.16 [-0.39, 0.63] | 0.4648 | 0.9296 | no |
| daedalus-mcp − none | 53 | 6 | 4.283 | 4.679 | -0.396 | [-2.057, 1.250] | -0.07 | 0.08 [-0.33, 0.36] | 0.6288 | 0.9296 | no |

| Arm | Step-1 level (reported apart) [task-cluster 95%] | Runs |
|---|---|---|
| none | 1.24 [0.80, 1.80] | 54 |
| daedalus-mcp | 1.04 [0.54, 1.76] | 54 |
| gate | 1.04 [0.44, 1.74] | 54 |

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
