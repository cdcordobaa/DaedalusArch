# Study 2 analysis rehearsal: scenario expected (expected effect (gate halves the slope, mcp quarters it))

> **SYNTHETIC / DRY-RUN DATA.** At least one run says `dryRun: true`. Nothing below is a measurement.

> Study 2 analysis rehearsal output (`scripts/v1.3/study2-analyse.ts`). NOT A PRE-REGISTRATION.

Seed 20261016; 4999 bootstrap resamples; 9999 Monte Carlo sign flips (exact at ≤ 14 units); α = 0.05; a run's slope needs ≥ 3 steps with an outcome.

## T0. Design as found

Runs 162; blocks 54; tasks 6; models claude-code-cli/synth-model-a, claude-code-cli/synth-model-b, codex-cli/synth-model-c; k ∈ {5}; arms none, daedalus-mcp, gate.

## T1. Pre-committed switch rule (pilot memo §3, §5)

Pilot memo §3: erosion EXISTS (new blocking findings after step 1 in 2 of 3 tasks). Per memo §5 the Study 2 primary outcome stays the blocking erosion slope.

| Pilot task | New blocking findings after step 1 (`none`) | Of which unlabelled | Excluded by label |
|---|---|---|---|
| synth-pilot-task-1 | 1 | 1 | 0 |
| synth-pilot-task-2 | 93 | 93 | 0 |
| synth-pilot-task-3 | 0 | 0 | 0 |

**Provisional:** the memo counts a new finding only when `check-correct.ts` labels it `correct` (or the author confirms a `not-checkable` one). No label file was given, so every new finding was counted.

**Fallback triggered:** no. **Primary outcome:** Erosion slope: blocking violations per step. **Memo definition met on these records:** yes.

Floor check (descriptive, cannot change the primary outcome): 187 of 270 `none` steps have a blocking finding; every Study 2 step zero: no.

## T2. Primary outcome: confirmatory contrasts (Holm over the two)

Outcome: Erosion slope: blocking violations per step. Per run, OLS slope on step 1..k; per block, arm − none; two-sided sign-flip test of the mean.

| Contrast | Blocks | Tasks | Mean slope arm | Mean slope ref | Mean diff | 95% CI (2-stage cluster bootstrap) | d_z | Relative reduction [95% CI] | Sign-flip p | Holm p | Reject at α |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gate − none | 54 | 6 | 0.462 | 1.167 | -0.705 | [-1.942, 0.061] | -0.32 | 0.60 [-0.12, 0.79] | 0.0037 | 0.0074 | yes |
| daedalus-mcp − none | 54 | 6 | 0.535 | 1.167 | -0.632 | [-1.848, 0.060] | -0.26 | 0.54 [-0.10, 0.77] | 0.0495 | 0.0495 | yes |

## T3. Task-level effects (forest plot F2) and the task-level test

| Contrast | Task | Blocks | Mean diff | 95% CI (blocks within task) |
|---|---|---|---|---|
| gate − none | synth-task-1 | 9 | -0.700 | [-1.289, -0.156] |
| gate − none | synth-task-2 | 9 | -0.083 | [-0.810, 0.346] |
| gate − none | synth-task-3 | 9 | -3.152 | [-6.323, -0.686] |
| gate − none | synth-task-4 | 9 | -0.197 | [-0.478, 0.089] |
| gate − none | synth-task-5 | 9 | 0.433 | [0.089, 0.833] |
| gate − none | synth-task-6 | 9 | -0.533 | [-0.833, -0.244] |
| daedalus-mcp − none | synth-task-1 | 9 | -0.314 | [-0.929, 0.264] |
| daedalus-mcp − none | synth-task-2 | 9 | -0.138 | [-0.816, 0.535] |
| daedalus-mcp − none | synth-task-3 | 9 | -2.619 | [-6.222, 0.407] |
| daedalus-mcp − none | synth-task-4 | 9 | -0.189 | [-0.667, 0.256] |
| daedalus-mcp − none | synth-task-5 | 9 | 0.222 | [-0.444, 0.778] |
| daedalus-mcp − none | synth-task-6 | 9 | -0.756 | [-1.156, -0.422] |

| Contrast | Task-level sign-flip p | Smallest attainable p | Tasks agreeing in sign |
|---|---|---|---|
| gate − none | 0.1563 | 0.0313 | 5 of 6 below 0 |
| daedalus-mcp − none | 0.1250 | 0.0313 | 5 of 6 below 0 |

## T4. Secondary contrast on the primary outcome (unadjusted)

| Contrast | Outcome | Blocks | Mean arm | Mean ref | Mean diff | 95% CI | d_z | Relative reduction [95% CI] | Unadjusted p |
|---|---|---|---|---|---|---|---|---|---|
| gate − daedalus-mcp | Erosion slope: blocking violations per step | 54 | 0.462 | 0.535 | -0.073 | [-0.472, 0.261] | -0.06 | 0.14 [-0.91, 0.58] | 0.6586 |

## T5. Primary outcome by model (model is a fixed factor; descriptive)

| Model | Contrast | Blocks | Mean diff | 95% CI | Relative reduction |
|---|---|---|---|---|---|
| claude-code-cli/synth-model-a | gate − none | 18 | -1.144 | [-3.662, 0.222] | 0.61 |
| claude-code-cli/synth-model-a | daedalus-mcp − none | 18 | -1.050 | [-3.473, 0.372] | 0.56 |
| claude-code-cli/synth-model-b | gate − none | 18 | -0.321 | [-0.872, 0.174] | 0.45 |
| claude-code-cli/synth-model-b | daedalus-mcp − none | 18 | -0.222 | [-0.801, 0.272] | 0.31 |
| codex-cli/synth-model-c | gate − none | 18 | -0.651 | [-1.826, 0.030] | 0.72 |
| codex-cli/synth-model-c | daedalus-mcp − none | 18 | -0.625 | [-2.178, 0.334] | 0.69 |

## T6. Secondary outcomes and guards (exploratory, unadjusted)

| Contrast | Outcome | Blocks | Mean arm | Mean ref | Mean diff | 95% CI | d_z | Relative reduction [95% CI] | Unadjusted p |
|---|---|---|---|---|---|---|---|---|---|
| gate − none | Erosion slope: blocking violations per KLOC, per step | 54 | -0.073 | 0.281 | -0.353 | [-1.181, 0.246] | -0.22 | 1.26 [0.22, 5.96] | 0.1029 |
| daedalus-mcp − none | Erosion slope: blocking violations per KLOC, per step | 54 | -0.065 | 0.281 | -0.345 | [-1.059, 0.133] | -0.20 | 1.23 [0.63, 8.50] | 0.1353 |
| gate − none | Advisory violations per KLOC (all advisory rules, FF-CV05 INCLUDED), slope per step | 54 | 0.450 | 1.128 | -0.679 | [-2.349, 0.640] | -0.20 | 0.60 [-1.37, 1.34] | 0.1420 |
| daedalus-mcp − none | Advisory violations per KLOC (all advisory rules, FF-CV05 INCLUDED), slope per step | 54 | 0.791 | 1.128 | -0.337 | [-1.851, 1.089] | -0.09 | 0.30 [-3.66, 1.13] | 0.5052 |
| gate − none | AHS (v1.2E symbolic) at step k | 50 | 0.615 | 0.563 | 0.052 | [-0.026, 0.162] | 0.25 | -0.09 [-0.37, 0.03] | 0.0809 |
| daedalus-mcp − none | AHS (v1.2E symbolic) at step k | 51 | 0.611 | 0.562 | 0.049 | [-0.048, 0.157] | 0.17 | -0.09 [-0.34, 0.09] | 0.2369 |
| gate − none | AHS slope per step | 54 | -0.065 | -0.083 | 0.018 | [-0.007, 0.044] | 0.36 | n/a n/a | 0.0095 |
| daedalus-mcp − none | AHS slope per step | 54 | -0.070 | -0.083 | 0.012 | [-0.008, 0.034] | 0.22 | n/a n/a | 0.1178 |
| gate − none | AHS area under the curve (trapezoid, per step) | 54 | 0.757 | 0.708 | 0.049 | [-0.002, 0.103] | 0.36 | -0.07 [-0.17, 0.00] | 0.0098 |
| daedalus-mcp − none | AHS area under the curve (trapezoid, per step) | 54 | 0.728 | 0.708 | 0.020 | [-0.040, 0.077] | 0.12 | -0.03 [-0.12, 0.05] | 0.4085 |
| gate − none | Blocking-only AHS at step k | 50 | 0.751 | 0.683 | 0.068 | [-0.024, 0.171] | 0.24 | -0.10 [-0.35, 0.02] | 0.0953 |
| daedalus-mcp − none | Blocking-only AHS at step k | 51 | 0.784 | 0.683 | 0.101 | [-0.031, 0.245] | 0.25 | -0.15 [-0.46, 0.03] | 0.0841 |
| gate − none | Blocking-only AHS slope per step | 54 | -0.036 | -0.061 | 0.024 | [-0.007, 0.057] | 0.36 | n/a n/a | 0.0104 |
| daedalus-mcp − none | Blocking-only AHS slope per step | 54 | -0.037 | -0.061 | 0.024 | [-0.007, 0.054] | 0.28 | n/a n/a | 0.0417 |
| gate − none | Blocking-only AHS area under the curve (trapezoid, per step) | 54 | 0.851 | 0.756 | 0.094 | [0.015, 0.188] | 0.47 | -0.12 [-0.30, -0.01] | 0.0008 |
| daedalus-mcp − none | Blocking-only AHS area under the curve (trapezoid, per step) | 54 | 0.806 | 0.756 | 0.050 | [-0.032, 0.145] | 0.21 | -0.07 [-0.21, 0.04] | 0.1319 |
| gate − none | LOC at step k (guard: feature dropping) | 54 | 2041.556 | 1921.815 | 119.741 | [-71.674, 309.563] | 0.20 | -0.06 [-0.18, 0.04] | 0.1439 |
| daedalus-mcp − none | LOC at step k (guard: feature dropping) | 54 | 1974.056 | 1921.815 | 52.241 | [-141.353, 257.850] | 0.09 | -0.03 [-0.15, 0.06] | 0.5240 |
| gate − none | Source files at step k (guard: feature dropping) | 54 | 58.352 | 54.889 | 3.463 | [-1.945, 8.796] | 0.20 | -0.06 [-0.17, 0.03] | 0.1411 |
| daedalus-mcp − none | Source files at step k (guard: feature dropping) | 54 | 56.370 | 54.889 | 1.481 | [-4.185, 7.001] | 0.08 | -0.03 [-0.14, 0.07] | 0.5367 |
| gate − none | Type-check errors per step (guard) | 54 | 0.152 | 0.137 | 0.015 | [-0.089, 0.107] | 0.06 | -0.11 [-0.93, 0.48] | 0.7493 |
| daedalus-mcp − none | Type-check errors per step (guard) | 54 | 0.181 | 0.137 | 0.044 | [-0.037, 0.130] | 0.20 | -0.32 [-1.33, 0.21] | 0.1722 |

## T7. Gate repair success (descriptive)

| Gate steps | Failing steps (repair ran) | Repairs with an evaluated outcome | Cleared | Share cleared [Wilson 95%] | Share cleared [task-cluster 95%] | Mean blocking before − after [95%] | Findings introduced by repairs | Repair evaluation failed |
|---|---|---|---|---|---|---|---|---|
| 270 | 233 | 231 | 57 | 0.25 [0.20, 0.31] | [0.15, 0.37] | 2.00 [1.83, 2.17] | 0 | 2 |

## T8. Cost and time (descriptive, task-cluster bootstrap 95%)

| Arm | Steps | Steps with a cost | USD per step | USD per run (runs with every cost) | Input tokens per step | Output tokens per step | Wall minutes per step | Agent turns per step | Repair turns | Repair USD | Usage-limit interruptions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| none | 270 | 180 | 3.24 [3.01, 3.48] | 16.20 [15.27, 17.25] | 63348 [59153, 68028] | 9700 [9180, 10231] | 4.3 [4.0, 4.6] | 15.0 [14.6, 15.5] | 0 | 0.00 | 0 |
| daedalus-mcp | 270 | 180 | 3.25 [3.07, 3.45] | 16.25 [15.31, 17.17] | 63513 [61074, 66086] | 9986 [9164, 10861] | 4.5 [4.2, 4.8] | 14.9 [14.4, 15.5] | 0 | 0.00 | 0 |
| gate | 270 | 180 | 4.33 [4.10, 4.59] | 21.67 [20.34, 22.94] | 86932 [83637, 90310] | 12600 [11957, 13310] | 5.7 [5.4, 6.0] | 20.3 [19.5, 21.0] | 233 | 203.76 | 0 |

## T9. Guards (descriptive)

| Arm | Steps | Evaluation errors | Steps with type-check errors | Mean type-check errors | Skeleton broken | Non-completed turns | Mean LOC step 1 | Mean LOC step k | Mean files step k | Runs with a LOC drop |
|---|---|---|---|---|---|---|---|---|---|---|
| none | 270 | 7 | 34 | 0.14 | 1 | 5 | 577 | 1922 | 54.9 | 0 |
| daedalus-mcp | 270 | 3 | 46 | 0.18 | 1 | 7 | 592 | 1974 | 56.4 | 0 |
| gate | 270 | 4 | 37 | 0.15 | 1 | 14 | 612 | 2042 | 58.4 | 0 |

## T10. Missingness per model and arm

| Model | Arm | Runs scheduled | Runs found | Runs complete | Steps expected | Steps recorded | Steps without outcome | Runs without a slope |
|---|---|---|---|---|---|---|---|---|
| claude-code-cli/synth-model-a | none | 18 | 18 | 18 | 90 | 90 | 2 | 0 |
| claude-code-cli/synth-model-a | daedalus-mcp | 18 | 18 | 18 | 90 | 90 | 1 | 0 |
| claude-code-cli/synth-model-a | gate | 18 | 18 | 18 | 90 | 90 | 2 | 0 |
| claude-code-cli/synth-model-b | none | 18 | 18 | 18 | 90 | 90 | 2 | 0 |
| claude-code-cli/synth-model-b | daedalus-mcp | 18 | 18 | 18 | 90 | 90 | 0 | 0 |
| claude-code-cli/synth-model-b | gate | 18 | 18 | 18 | 90 | 90 | 2 | 0 |
| codex-cli/synth-model-c | none | 18 | 18 | 18 | 90 | 90 | 3 | 0 |
| codex-cli/synth-model-c | daedalus-mcp | 18 | 18 | 18 | 90 | 90 | 2 | 0 |
| codex-cli/synth-model-c | gate | 18 | 18 | 18 | 90 | 90 | 0 | 0 |

## T11. Trajectories (figure F1): mean per arm and step [normal 95%]

| Arm | Step | n | Primary outcome per step | Blocking per step | AHS |
|---|---|---|---|---|---|
| none | 1 | 52 | 1.212 [0.780, 1.643] | 1.212 | 0.883 |
| none | 2 | 53 | 1.943 [1.336, 2.551] | 1.943 | 0.807 |
| none | 3 | 53 | 3.604 [2.390, 4.817] | 3.604 | 0.692 |
| none | 4 | 53 | 4.604 [3.183, 6.025] | 4.604 | 0.614 |
| none | 5 | 52 | 5.769 [2.749, 8.789] | 5.769 | 0.565 |
| daedalus-mcp | 1 | 54 | 1.111 [0.777, 1.446] | 1.111 | 0.881 |
| daedalus-mcp | 2 | 53 | 2.000 [1.228, 2.772] | 2.000 | 0.800 |
| daedalus-mcp | 3 | 53 | 2.509 [1.564, 3.455] | 2.509 | 0.734 |
| daedalus-mcp | 4 | 54 | 3.611 [2.480, 4.742] | 3.611 | 0.641 |
| daedalus-mcp | 5 | 53 | 3.000 [1.860, 4.140] | 3.000 | 0.609 |
| gate | 1 | 54 | 1.019 [0.673, 1.364] | 1.019 | 0.886 |
| gate | 2 | 54 | 1.556 [1.006, 2.106] | 1.556 | 0.817 |
| gate | 3 | 53 | 1.849 [1.158, 2.540] | 1.849 | 0.756 |
| gate | 4 | 53 | 2.094 [1.542, 2.646] | 2.094 | 0.695 |
| gate | 5 | 52 | 3.154 [2.294, 4.014] | 3.154 | 0.618 |

## Not computable from the step records

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
