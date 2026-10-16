# Study 2 analysis rehearsal: scenario small (small effect (gate 0.2, mcp 0.1))

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
| synth-pilot-task-3 | 6 | 6 | 0 |

**Provisional:** the memo counts a new finding only when `check-correct.ts` labels it `correct` (or the author confirms a `not-checkable` one). No label file was given, so every new finding was counted.

**Fallback triggered:** no. **Primary outcome:** Erosion slope: blocking violations per step. **Memo definition met on these records:** yes.

- Primary scale slot UNFILLED (A3, author decision): T2 shows the raw slope as a placeholder; T2b shows both scales side by side, each with its own Holm.

Floor check (descriptive, cannot change the primary outcome): 198 of 270 `none` steps have a blocking finding; every Study 2 step zero: no.

## T2. Primary outcome: confirmatory contrasts (Holm over the two)

*Outcome: Erosion slope: blocking violations per step · scale: raw (placeholder: primary slot UNFILLED, A3) · inference: Monte Carlo sign-flip (9999 flips) + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

Outcome: Erosion slope: blocking violations per step. Per run, OLS slope on step 1..k; per block, arm − none; two-sided sign-flip test of the mean.

| Contrast | Blocks | Tasks | Mean slope arm | Mean slope ref | Mean diff | 95% CI (2-stage cluster bootstrap) | d_z | Relative reduction [95% CI] | Sign-flip p | Holm p | Reject at α |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gate − none | 54 | 6 | 0.748 | 0.843 | -0.094 | [-0.593, 0.361] | -0.06 | 0.11 [-0.63, 0.51] | 0.6878 | 1.0000 | no |
| daedalus-mcp − none | 54 | 6 | 0.742 | 0.843 | -0.101 | [-0.689, 0.374] | -0.07 | 0.12 [-0.80, 0.54] | 0.6103 | 1.0000 | no |

**Decision rule (A1):** UNFILLED (author decision). Both decisions are shown below; neither is named confirmatory. The "Reject at α" column above is the sign-flip Holm decision, kept from the rehearsal as a placeholder.

### T2a. Inference per confirmatory contrast

*Outcome: Erosion slope: blocking violations per step · scale: raw · inference: Monte Carlo sign-flip (9999 flips) + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

| Contrast | Outcome | Units | Test | Test seed | p | MC SE of p | p near a Holm threshold | Bootstrap (resamples, seed) | CI excludes 0 | p ≤ α | Disagreement |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gate − none | Erosion slope: blocking violations per step | 54 | Monte Carlo sign-flip | 20361026 | 0.6878 | 0.0046 | no | 4999, 20261026 | no | no | no |
| daedalus-mcp − none | Erosion slope: blocking violations per step | 54 | Monte Carlo sign-flip | 20361027 | 0.6103 | 0.0049 | no | 4999, 20261027 | no | no | no |

α = 0.05. "Near a Holm threshold": a Monte Carlo p within 3 SE of α or α/2.

### T2b. Both blocking scales side by side (each with its own Holm over the two contrasts)

*Outcome: blocking violations, erosion slope · scale: raw and perKloc · inference: Monte Carlo sign-flip (9999 flips) + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

| Scale | Contrast | Blocks | Mean diff | 95% CI | Sign-flip p | Holm p | Holm rejects | CI excludes 0 | Disagreement | T2 uses this scale |
|---|---|---|---|---|---|---|---|---|---|---|
| raw | gate − none | 54 | -0.094 | [-0.593, 0.361] | 0.6878 | 1.0000 | no | no | no | placeholder |
| raw | daedalus-mcp − none | 54 | -0.101 | [-0.689, 0.374] | 0.6103 | 1.0000 | no | no | no | placeholder |
| perKloc | gate − none | 54 | -0.055 | [-0.371, 0.262] | 0.7332 | 1.0000 | no | no | no | no |
| perKloc | daedalus-mcp − none | 54 | 0.005 | [-0.393, 0.321] | 0.9733 | 1.0000 | no | no | no | no |

## T3. Task-level effects (forest plot F2) and the task-level test

*Outcome: Erosion slope: blocking violations per step · scale: raw · inference: exact sign-flip over task means + per-task block bootstrap (≤ 1999 resamples) · seed 20261016 (plan).*

| Contrast | Task | Blocks | Mean diff | 95% CI (blocks within task) |
|---|---|---|---|---|
| gate − none | synth-task-1 | 9 | -0.400 | [-0.956, 0.144] |
| gate − none | synth-task-2 | 9 | -0.078 | [-0.567, 0.412] |
| gate − none | synth-task-3 | 9 | -0.078 | [-2.422, 1.867] |
| gate − none | synth-task-4 | 9 | -0.178 | [-0.878, 0.344] |
| gate − none | synth-task-5 | 9 | 0.133 | [-0.767, 0.922] |
| gate − none | synth-task-6 | 9 | 0.033 | [-0.667, 0.700] |
| daedalus-mcp − none | synth-task-1 | 9 | -0.267 | [-0.900, 0.289] |
| daedalus-mcp − none | synth-task-2 | 9 | 0.222 | [-0.189, 0.722] |
| daedalus-mcp − none | synth-task-3 | 9 | -1.078 | [-2.523, 0.156] |
| daedalus-mcp − none | synth-task-4 | 9 | 0.438 | [-0.523, 1.272] |
| daedalus-mcp − none | synth-task-5 | 9 | 0.367 | [-0.133, 0.878] |
| daedalus-mcp − none | synth-task-6 | 9 | -0.287 | [-1.056, 0.400] |

| Contrast | Task-level sign-flip p | Smallest attainable p | Tasks agreeing in sign |
|---|---|---|---|
| gate − none | 0.2813 | 0.0313 | 4 of 6 below 0 |
| daedalus-mcp − none | 0.7500 | 0.0313 | 3 of 6 below 0 |

## T4. Secondary contrast on the primary outcome (unadjusted)

*Outcome: Erosion slope: blocking violations per step · scale: raw · inference: Monte Carlo sign-flip (9999 flips) + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

| Contrast | Outcome | Blocks | Mean arm | Mean ref | Mean diff | 95% CI | d_z | Relative reduction [95% CI] | Unadjusted p |
|---|---|---|---|---|---|---|---|---|---|
| gate − daedalus-mcp | Erosion slope: blocking violations per step | 54 | 0.748 | 0.742 | 0.006 | [-0.509, 0.592] | 0.00 | -0.01 [-1.07, 0.59] | 0.9817 |

## T5. Primary outcome by model (model is a fixed factor; descriptive)

*Outcome: Erosion slope: blocking violations per step · scale: raw · inference: exact sign-flip + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

| Model | Contrast | Blocks | Mean diff | 95% CI | Relative reduction | Sign-flip p | Test |
|---|---|---|---|---|---|---|---|
| claude-code-cli/synth-model-a | gate − none | 18 | -0.900 | [-2.461, 0.178] | 0.48 | 0.1564 | exact sign-flip |
| claude-code-cli/synth-model-a | daedalus-mcp − none | 18 | -0.552 | [-1.928, 0.703] | 0.30 | 0.3005 | exact sign-flip |
| claude-code-cli/synth-model-b | gate − none | 18 | 0.378 | [-0.061, 0.806] | -0.88 | 0.0535 | exact sign-flip |
| claude-code-cli/synth-model-b | daedalus-mcp − none | 18 | -0.006 | [-0.356, 0.339] | 0.01 | 1.0000 | exact sign-flip |
| codex-cli/synth-model-c | gate − none | 18 | 0.239 | [-0.278, 0.828] | -1.05 | 0.2578 | exact sign-flip |
| codex-cli/synth-model-c | daedalus-mcp − none | 18 | 0.256 | [-0.122, 0.639] | -1.12 | 0.1240 | exact sign-flip |

## T6. Secondary outcomes and guards (exploratory, unadjusted)

*Outcome: per row (column Outcome) · scale: per row (per KLOC where the outcome says so, else raw) · inference: Monte Carlo sign-flip (9999 flips) + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

| Contrast | Outcome | Blocks | Mean arm | Mean ref | Mean diff | 95% CI | d_z | Relative reduction [95% CI] | Unadjusted p |
|---|---|---|---|---|---|---|---|---|---|
| gate − none | Erosion slope: blocking violations per KLOC, per step | 54 | -0.030 | 0.025 | -0.055 | [-0.376, 0.273] | -0.05 | 2.17 [-5.06, 19.50] | 0.7318 |
| daedalus-mcp − none | Erosion slope: blocking violations per KLOC, per step | 54 | 0.031 | 0.025 | 0.005 | [-0.403, 0.314] | 0.00 | -0.20 [-13.76, 12.70] | 0.9745 |
| gate − none | Advisory violations per KLOC (FF-CV05 excluded), slope per step | 54 | 0.721 | 0.759 | -0.038 | [-0.774, 0.821] | -0.02 | 0.05 [-2.76, 0.71] | 0.9042 |
| daedalus-mcp − none | Advisory violations per KLOC (FF-CV05 excluded), slope per step | 54 | 0.285 | 0.759 | -0.474 | [-1.159, 0.220] | -0.22 | 0.62 [-0.67, 1.21] | 0.1147 |
| gate − none | Advisory violations per KLOC (all advisory rules, FF-CV05 INCLUDED), slope per step | 54 | 0.569 | 0.814 | -0.245 | [-1.347, 1.164] | -0.08 | 0.30 [-5.05, 1.17] | 0.5615 |
| daedalus-mcp − none | Advisory violations per KLOC (all advisory rules, FF-CV05 INCLUDED), slope per step | 54 | 0.349 | 0.814 | -0.465 | [-1.299, 0.489] | -0.17 | 0.57 [-2.17, 1.34] | 0.2176 |
| gate − none | AHS (v1.2E symbolic) at step k | 52 | 0.541 | 0.565 | -0.024 | [-0.133, 0.084] | -0.10 | 0.04 [-0.15, 0.23] | 0.4865 |
| daedalus-mcp − none | AHS (v1.2E symbolic) at step k | 51 | 0.568 | 0.565 | 0.003 | [-0.057, 0.075] | 0.01 | -0.01 [-0.14, 0.10] | 0.9272 |
| gate − none | AHS slope per step | 54 | -0.078 | -0.078 | -0.000 | [-0.023, 0.020] | -0.00 | n/a n/a | 0.9899 |
| daedalus-mcp − none | AHS slope per step | 54 | -0.078 | -0.078 | 0.001 | [-0.015, 0.016] | 0.01 | n/a n/a | 0.9340 |
| gate − none | AHS area under the curve (trapezoid, per step) | 54 | 0.713 | 0.713 | 0.000 | [-0.045, 0.050] | 0.00 | -0.00 [-0.07, 0.06] | 0.9984 |
| daedalus-mcp − none | AHS area under the curve (trapezoid, per step) | 54 | 0.729 | 0.713 | 0.015 | [-0.024, 0.054] | 0.13 | -0.02 [-0.09, 0.03] | 0.3452 |
| gate − none | Blocking-only AHS at step k | 52 | 0.652 | 0.709 | -0.058 | [-0.202, 0.088] | -0.16 | 0.08 [-0.12, 0.30] | 0.2767 |
| daedalus-mcp − none | Blocking-only AHS at step k | 51 | 0.688 | 0.711 | -0.024 | [-0.127, 0.073] | -0.07 | 0.03 [-0.11, 0.16] | 0.6127 |
| gate − none | Blocking-only AHS slope per step | 54 | -0.054 | -0.049 | -0.005 | [-0.034, 0.022] | -0.05 | n/a n/a | 0.7169 |
| daedalus-mcp − none | Blocking-only AHS slope per step | 54 | -0.056 | -0.049 | -0.007 | [-0.033, 0.022] | -0.08 | n/a n/a | 0.5576 |
| gate − none | Blocking-only AHS area under the curve (trapezoid, per step) | 54 | 0.794 | 0.793 | 0.000 | [-0.060, 0.080] | 0.00 | -0.00 [-0.10, 0.07] | 0.9990 |
| daedalus-mcp − none | Blocking-only AHS area under the curve (trapezoid, per step) | 54 | 0.812 | 0.793 | 0.019 | [-0.032, 0.071] | 0.12 | -0.02 [-0.10, 0.04] | 0.3815 |
| gate − none | LOC at step k (guard: feature dropping) | 54 | 2066.815 | 2105.889 | -39.074 | [-305.352, 238.108] | -0.06 | 0.02 [-0.13, 0.14] | 0.6846 |
| daedalus-mcp − none | LOC at step k (guard: feature dropping) | 54 | 2137.333 | 2105.889 | 31.444 | [-200.857, 251.787] | 0.04 | -0.01 [-0.13, 0.08] | 0.7424 |
| gate − none | Source files at step k (guard: feature dropping) | 54 | 58.981 | 60.148 | -1.167 | [-8.704, 6.594] | -0.06 | 0.02 [-0.12, 0.13] | 0.6812 |
| daedalus-mcp − none | Source files at step k (guard: feature dropping) | 54 | 61.185 | 60.148 | 1.037 | [-5.519, 7.574] | 0.05 | -0.02 [-0.14, 0.08] | 0.7146 |
| gate − none | Type-check errors per step (guard) | 54 | 0.189 | 0.111 | 0.078 | [-0.022, 0.189] | 0.32 | -0.70 [-3.29, 0.14] | 0.0286 |
| daedalus-mcp − none | Type-check errors per step (guard) | 54 | 0.174 | 0.111 | 0.063 | [-0.026, 0.148] | 0.27 | -0.57 [-2.22, 0.18] | 0.0718 |

## T7. Gate repair success (descriptive)

*Outcome: repair cleared the step; blocking before − after · scale: raw · inference: Wilson + task-cluster bootstrap (≤ 1999 resamples, seed + 900) · seed 20261016 (plan).*

| Gate steps | Failing steps (repair ran) | Repairs with an evaluated outcome | Cleared | Share cleared [Wilson 95%] | Share cleared [task-cluster 95%] | Mean blocking before − after [95%] | Findings introduced by repairs | Repair evaluation failed |
|---|---|---|---|---|---|---|---|---|
| 270 | 241 | 240 | 41 | 0.17 [0.13, 0.22] | [0.09, 0.26] | 2.01 [1.82, 2.20] | 0 | 1 |

## T8. Cost and time (descriptive, task-cluster bootstrap 95%)

*Outcome: cost, tokens, time, turns · scale: per step and per run · inference: task-cluster bootstrap (≤ 1999 resamples, seed + 700) · seed 20261016 (plan).*

| Arm | Steps | Steps with a cost | USD per step | USD per run (runs with every cost) | Input tokens per step | Output tokens per step | Wall minutes per step | Agent turns per step | Repair turns | Repair USD | Usage-limit interruptions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| none | 270 | 180 | 3.23 [3.06, 3.39] | 16.14 [15.37, 16.91] | 61648 [58746, 64683] | 9456 [8755, 10175] | 4.5 [4.2, 4.8] | 15.6 [14.9, 16.4] | 0 | 0.00 | 0 |
| daedalus-mcp | 270 | 180 | 3.31 [3.09, 3.56] | 16.57 [15.57, 17.69] | 61870 [59068, 65032] | 9619 [9011, 10397] | 4.5 [4.2, 4.8] | 15.2 [14.6, 15.8] | 0 | 0.00 | 0 |
| gate | 270 | 180 | 4.30 [4.03, 4.60] | 21.48 [20.19, 22.97] | 86337 [83559, 89196] | 12681 [12016, 13428] | 5.7 [5.4, 5.9] | 19.8 [19.1, 20.5] | 241 | 204.09 | 0 |

## T9. Guards (descriptive)

*Outcome: guards (evaluation errors, type-check, skeleton, LOC, files) · scale: raw · inference: none (counts and means) · seed 20261016 (plan).*

| Arm | Steps | Evaluation errors | Steps with type-check errors | Mean type-check errors | Skeleton broken | Non-completed turns | Mean LOC step 1 | Mean LOC step k | Mean files step k | Runs with a LOC drop |
|---|---|---|---|---|---|---|---|---|---|---|
| none | 270 | 2 | 28 | 0.11 | 0 | 12 | 632 | 2106 | 60.1 | 0 |
| daedalus-mcp | 270 | 4 | 41 | 0.17 | 1 | 14 | 641 | 2137 | 61.2 | 0 |
| gate | 270 | 3 | 44 | 0.19 | 3 | 21 | 620 | 2067 | 59.0 | 0 |

## T10. Missingness per model and arm

*Outcome: missingness · scale: raw · inference: none (counts) · seed 20261016 (plan).*

| Model | Arm | Runs scheduled | Runs found | Runs complete | Steps expected | Steps recorded | Steps without outcome | Runs without a slope |
|---|---|---|---|---|---|---|---|---|
| claude-code-cli/synth-model-a | none | 18 | 18 | 18 | 90 | 90 | 1 | 0 |
| claude-code-cli/synth-model-a | daedalus-mcp | 18 | 18 | 18 | 90 | 90 | 4 | 0 |
| claude-code-cli/synth-model-a | gate | 18 | 18 | 18 | 90 | 90 | 1 | 0 |
| claude-code-cli/synth-model-b | none | 18 | 18 | 18 | 90 | 90 | 0 | 0 |
| claude-code-cli/synth-model-b | daedalus-mcp | 18 | 18 | 18 | 90 | 90 | 0 | 0 |
| claude-code-cli/synth-model-b | gate | 18 | 18 | 18 | 90 | 90 | 0 | 0 |
| codex-cli/synth-model-c | none | 18 | 18 | 18 | 90 | 90 | 1 | 0 |
| codex-cli/synth-model-c | daedalus-mcp | 18 | 18 | 18 | 90 | 90 | 0 | 0 |
| codex-cli/synth-model-c | gate | 18 | 18 | 18 | 90 | 90 | 2 | 0 |

## T11. Trajectories (figure F1): mean per arm and step [normal 95%]

*Outcome: Erosion slope: blocking violations per step; blocking; AHS (per step) · scale: raw · inference: normal 95% interval (no resampling) · seed 20261016 (plan).*

| Arm | Step | n | Primary outcome per step | Blocking per step | AHS |
|---|---|---|---|---|---|
| none | 1 | 54 | 1.241 [0.760, 1.721] | 1.241 | 0.869 |
| none | 2 | 54 | 2.204 [1.447, 2.961] | 2.204 | 0.788 |
| none | 3 | 54 | 2.574 [1.738, 3.410] | 2.574 | 0.721 |
| none | 4 | 54 | 3.926 [2.410, 5.442] | 3.926 | 0.620 |
| none | 5 | 52 | 4.519 [2.554, 6.484] | 4.519 | 0.565 |
| daedalus-mcp | 1 | 54 | 1.056 [0.636, 1.475] | 1.056 | 0.879 |
| daedalus-mcp | 2 | 53 | 1.642 [1.078, 2.205] | 1.642 | 0.802 |
| daedalus-mcp | 3 | 53 | 2.340 [1.608, 3.071] | 2.340 | 0.737 |
| daedalus-mcp | 4 | 53 | 2.868 [2.057, 3.679] | 2.868 | 0.657 |
| daedalus-mcp | 5 | 53 | 4.132 [2.950, 5.314] | 4.132 | 0.569 |
| gate | 1 | 53 | 1.302 [0.822, 1.782] | 1.302 | 0.868 |
| gate | 2 | 54 | 2.556 [1.443, 3.668] | 2.556 | 0.777 |
| gate | 3 | 52 | 2.096 [1.443, 2.749] | 2.096 | 0.731 |
| gate | 4 | 54 | 3.056 [2.286, 3.825] | 3.056 | 0.642 |
| gate | 5 | 54 | 4.833 [3.363, 6.304] | 4.833 | 0.543 |

## T12. Outcome columns (`--outcome`; exploratory unless the author names one primary)

An outcome T2 or T2b already computed reuses those contrasts (same seeds). For `newIdentitiesFromStep2` the "Mean slope" columns hold the mean per-run count.

### blockingCount

*Outcome: Erosion slope: blocking violations per step · scale: raw · inference: Monte Carlo sign-flip (9999 flips) + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

| Contrast | Blocks | Tasks | Mean slope arm | Mean slope ref | Mean diff | 95% CI (2-stage cluster bootstrap) | d_z | Relative reduction [95% CI] | Sign-flip p | Holm p | Reject at α |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gate − none | 54 | 6 | 0.748 | 0.843 | -0.094 | [-0.593, 0.361] | -0.06 | 0.11 [-0.63, 0.51] | 0.6878 | 1.0000 | no |
| daedalus-mcp − none | 54 | 6 | 0.742 | 0.843 | -0.101 | [-0.689, 0.374] | -0.07 | 0.12 [-0.80, 0.54] | 0.6103 | 1.0000 | no |

| Arm | Step-1 level (reported apart) [task-cluster 95%] | Runs |
|---|---|---|
| none | 1.24 [0.69, 2.02] | 54 |
| daedalus-mcp | 1.06 [0.56, 1.87] | 54 |
| gate | 1.30 [0.63, 2.09] | 53 |

### blockingPerKloc

*Outcome: Erosion slope: blocking violations per KLOC, per step · scale: perKloc · inference: Monte Carlo sign-flip (9999 flips) + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

| Contrast | Blocks | Tasks | Mean slope arm | Mean slope ref | Mean diff | 95% CI (2-stage cluster bootstrap) | d_z | Relative reduction [95% CI] | Sign-flip p | Holm p | Reject at α |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gate − none | 54 | 6 | -0.030 | 0.025 | -0.055 | [-0.371, 0.262] | -0.05 | 2.17 [-6.65, 18.24] | 0.7332 | 1.0000 | no |
| daedalus-mcp − none | 54 | 6 | 0.031 | 0.025 | 0.005 | [-0.393, 0.321] | 0.00 | -0.20 [-14.70, 9.86] | 0.9733 | 1.0000 | no |

| Arm | Step-1 level (reported apart) [task-cluster 95%] | Runs |
|---|---|---|
| none | 2.27 [1.15, 3.92] | 54 |
| daedalus-mcp | 1.86 [0.94, 3.28] | 54 |
| gate | 2.10 [1.09, 3.45] | 53 |

### distinctViolatingEdges

*Outcome: Erosion slope: distinct violating edges per step (FF-S01/FF-S03 deduplicated) · scale: raw · inference: Monte Carlo sign-flip (9999 flips) + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

| Contrast | Blocks | Tasks | Mean slope arm | Mean slope ref | Mean diff | 95% CI (2-stage cluster bootstrap) | d_z | Relative reduction [95% CI] | Sign-flip p | Holm p | Reject at α |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gate − none | 54 | 6 | 0.748 | 0.843 | -0.094 | [-0.565, 0.367] | -0.06 | 0.11 [-0.62, 0.53] | 0.6935 | 1.0000 | no |
| daedalus-mcp − none | 54 | 6 | 0.742 | 0.843 | -0.101 | [-0.694, 0.386] | -0.07 | 0.12 [-0.80, 0.54] | 0.6087 | 1.0000 | no |

| Arm | Step-1 level (reported apart) [task-cluster 95%] | Runs |
|---|---|---|
| none | 1.24 [0.69, 2.06] | 54 |
| daedalus-mcp | 1.06 [0.54, 1.85] | 54 |
| gate | 1.30 [0.65, 2.19] | 53 |

- Duplicates removed (same file pair and direction across FF-S01/FF-S03): none.
- Steps whose listed findings are fewer than their blocking count (capped listing; dedup partial): 0 of 810.

### newIdentitiesFromStep2

*Outcome: Blocking identities first seen at step 2..k, per run (memo §3 identity) · scale: raw · inference: Monte Carlo sign-flip (9999 flips) + two-stage cluster percentile bootstrap (4999 resamples) · seed 20261016 (plan).*

| Contrast | Blocks | Tasks | Mean slope arm | Mean slope ref | Mean diff | 95% CI (2-stage cluster bootstrap) | d_z | Relative reduction [95% CI] | Sign-flip p | Holm p | Reject at α |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gate − none | 49 | 6 | 2.980 | 5.265 | -2.286 | [-5.320, 0.512] | -0.26 | 0.43 [-0.12, 0.73] | 0.0850 | 0.1700 | no |
| daedalus-mcp − none | 48 | 6 | 4.396 | 4.792 | -0.396 | [-2.714, 1.408] | -0.06 | 0.08 [-0.39, 0.44] | 0.6963 | 0.6963 | no |

| Arm | Step-1 level (reported apart) [task-cluster 95%] | Runs |
|---|---|---|
| none | 1.24 [0.67, 2.09] | 54 |
| daedalus-mcp | 1.06 [0.54, 1.80] | 54 |
| gate | 1.30 [0.66, 2.24] | 53 |

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
