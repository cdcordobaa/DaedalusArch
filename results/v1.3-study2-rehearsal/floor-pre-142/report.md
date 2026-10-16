# Study 2 analysis rehearsal: scenario floor-pre-142 (floor: zero blocking findings everywhere; expected effect on the advisory rules) — records as written before PR #142 (no advisoryByRule)

> **SYNTHETIC / DRY-RUN DATA.** At least one run says `dryRun: true`. Nothing below is a measurement.

> Study 2 analysis rehearsal output (`scripts/v1.3/study2-analyse.ts`). NOT A PRE-REGISTRATION.

Seed 20261016; 4999 bootstrap resamples; 9999 Monte Carlo sign flips (exact at ≤ 14 units); α = 0.05; a run's slope needs ≥ 3 steps with an outcome.

## T0. Design as found

Runs 162; blocks 54; tasks 6; models claude-code-cli/synth-model-a, claude-code-cli/synth-model-b, codex-cli/synth-model-c; k ∈ {5}; arms none, daedalus-mcp, gate.

## T1. Pre-committed switch rule (pilot memo §3, §5)

Pilot memo §3: the primary outcome is ZERO (no new blocking finding after step 1 in any of 3 tasks). Per memo §5 the PRE-COMMITTED FALLBACK applies: the Study 2 primary outcome moves to the advisory-tier erosion rate (per-run slope of advisory findings per KLOC, FF-CV05 excluded).

| Pilot task | New blocking findings after step 1 (`none`) | Of which unlabelled | Excluded by label |
|---|---|---|---|
| synth-pilot-task-1 | 0 | 0 | 0 |
| synth-pilot-task-2 | 0 | 0 | 0 |
| synth-pilot-task-3 | 0 | 0 | 0 |

**Provisional:** the memo counts a new finding only when `check-correct.ts` labels it `correct` (or the author confirms a `not-checkable` one). No label file was given, so every new finding was counted.

**Fallback triggered:** YES. **Primary outcome:** Advisory violations per KLOC (all advisory rules, FF-CV05 INCLUDED), slope per step. **Memo definition met on these records:** NO.

- The memo §5 fallback outcome (advisory per KLOC WITHOUT FF-CV05) is NOT computable from these step records: these records carry only `advisoryViolationCount`, no `advisoryByRule` (records written before PR #142, or by an evaluator that omits it; readiness gate S6). The table below uses ALL advisory rules, FF-CV05 included, as a labelled surrogate; it is not the pre-committed outcome.
- Under the advisory branch the `gate` arm still shows blocking findings only; whether `gate` gets the advisory subset or is dropped is undecided (memo §5, readiness gate D11b). The gate contrast is computed as designed and must be read with that caveat.

Floor check (descriptive, cannot change the primary outcome): 0 of 270 `none` steps have a blocking finding; every Study 2 step zero: yes.

## T2. Primary outcome: confirmatory contrasts (Holm over the two)

Outcome: Advisory violations per KLOC (all advisory rules, FF-CV05 INCLUDED), slope per step. Per run, OLS slope on step 1..k; per block, arm − none; two-sided sign-flip test of the mean.

| Contrast | Blocks | Tasks | Mean slope arm | Mean slope ref | Mean diff | 95% CI (2-stage cluster bootstrap) | d_z | Relative reduction [95% CI] | Sign-flip p | Holm p | Reject at α |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gate − none | 54 | 6 | 0.473 | 0.231 | 0.242 | [-0.811, 1.310] | 0.08 | -1.05 [-18.07, 2.72] | 0.5561 | 1.0000 | no |
| daedalus-mcp − none | 54 | 6 | 0.041 | 0.231 | -0.190 | [-1.314, 1.083] | -0.06 | 0.82 [-9.36, 7.86] | 0.6735 | 1.0000 | no |

## T3. Task-level effects (forest plot F2) and the task-level test

| Contrast | Task | Blocks | Mean diff | 95% CI (blocks within task) |
|---|---|---|---|---|
| gate − none | synth-task-1 | 9 | 0.347 | [-1.461, 2.304] |
| gate − none | synth-task-2 | 9 | -1.488 | [-3.414, 0.065] |
| gate − none | synth-task-3 | 9 | 1.691 | [-0.855, 4.223] |
| gate − none | synth-task-4 | 9 | -0.158 | [-1.670, 1.431] |
| gate − none | synth-task-5 | 9 | 0.541 | [-0.962, 1.919] |
| gate − none | synth-task-6 | 9 | 0.519 | [-1.259, 2.294] |
| daedalus-mcp − none | synth-task-1 | 9 | -1.093 | [-2.721, 0.528] |
| daedalus-mcp − none | synth-task-2 | 9 | -0.839 | [-2.321, 0.628] |
| daedalus-mcp − none | synth-task-3 | 9 | 0.765 | [-1.929, 3.940] |
| daedalus-mcp − none | synth-task-4 | 9 | -1.100 | [-2.360, 0.145] |
| daedalus-mcp − none | synth-task-5 | 9 | -0.920 | [-2.622, 0.756] |
| daedalus-mcp − none | synth-task-6 | 9 | 2.048 | [-0.498, 4.222] |

| Contrast | Task-level sign-flip p | Smallest attainable p | Tasks agreeing in sign |
|---|---|---|---|
| gate − none | 0.5625 | 0.0313 | 2 of 6 below 0 |
| daedalus-mcp − none | 0.7188 | 0.0313 | 4 of 6 below 0 |

## T4. Secondary contrast on the primary outcome (unadjusted)

| Contrast | Outcome | Blocks | Mean arm | Mean ref | Mean diff | 95% CI | d_z | Relative reduction [95% CI] | Unadjusted p |
|---|---|---|---|---|---|---|---|---|---|
| gate − daedalus-mcp | Advisory violations per KLOC (all advisory rules, FF-CV05 INCLUDED), slope per step | 54 | 0.473 | 0.041 | 0.432 | [-0.834, 1.586] | 0.13 | -10.41 [-38.77, 3.12] | 0.3292 |

## T5. Primary outcome by model (model is a fixed factor; descriptive)

| Model | Contrast | Blocks | Mean diff | 95% CI | Relative reduction |
|---|---|---|---|---|---|
| claude-code-cli/synth-model-a | gate − none | 18 | 0.304 | [-2.053, 2.571] | -0.55 |
| claude-code-cli/synth-model-a | daedalus-mcp − none | 18 | -1.024 | [-3.117, 1.703] | 1.84 |
| claude-code-cli/synth-model-b | gate − none | 18 | 0.291 | [-1.362, 2.069] | -0.56 |
| claude-code-cli/synth-model-b | daedalus-mcp − none | 18 | 0.229 | [-1.883, 2.830] | -0.44 |
| codex-cli/synth-model-c | gate − none | 18 | 0.131 | [-1.247, 1.439] | n/a |
| codex-cli/synth-model-c | daedalus-mcp − none | 18 | 0.226 | [-1.487, 1.810] | n/a |

## T6. Secondary outcomes and guards (exploratory, unadjusted)

| Contrast | Outcome | Blocks | Mean arm | Mean ref | Mean diff | 95% CI | d_z | Relative reduction [95% CI] | Unadjusted p |
|---|---|---|---|---|---|---|---|---|---|
| gate − none | Erosion slope: blocking violations per step | 54 | 0.000 | 0.000 | 0.000 | [0.000, 0.000] | n/a | n/a n/a | 1.0000 |
| daedalus-mcp − none | Erosion slope: blocking violations per step | 54 | 0.000 | 0.000 | 0.000 | [0.000, 0.000] | n/a | n/a n/a | 1.0000 |
| gate − none | Erosion slope: blocking violations per KLOC, per step | 54 | 0.000 | 0.000 | 0.000 | [0.000, 0.000] | n/a | n/a n/a | 1.0000 |
| daedalus-mcp − none | Erosion slope: blocking violations per KLOC, per step | 54 | 0.000 | 0.000 | 0.000 | [0.000, 0.000] | n/a | n/a n/a | 1.0000 |
| gate − none | AHS (v1.2E symbolic) at step k | 51 | 0.728 | 0.747 | -0.018 | [-0.064, 0.023] | -0.16 | 0.02 [-0.03, 0.09] | 0.2496 |
| daedalus-mcp − none | AHS (v1.2E symbolic) at step k | 53 | 0.737 | 0.745 | -0.009 | [-0.057, 0.037] | -0.06 | 0.01 [-0.05, 0.08] | 0.6409 |
| gate − none | AHS slope per step | 54 | -0.047 | -0.046 | -0.002 | [-0.012, 0.008] | -0.07 | n/a n/a | 0.6021 |
| daedalus-mcp − none | AHS slope per step | 54 | -0.047 | -0.046 | -0.001 | [-0.012, 0.008] | -0.05 | n/a n/a | 0.7036 |
| gate − none | AHS area under the curve (trapezoid, per step) | 54 | 0.833 | 0.836 | -0.003 | [-0.027, 0.020] | -0.05 | 0.00 [-0.02, 0.03] | 0.7130 |
| daedalus-mcp − none | AHS area under the curve (trapezoid, per step) | 54 | 0.827 | 0.836 | -0.009 | [-0.034, 0.017] | -0.12 | 0.01 [-0.02, 0.04] | 0.3749 |
| gate − none | Blocking-only AHS at step k | 51 | 1.000 | 1.000 | 0.000 | [0.000, 0.000] | n/a | 0.00 [0.00, 0.00] | 1.0000 |
| daedalus-mcp − none | Blocking-only AHS at step k | 53 | 1.000 | 1.000 | 0.000 | [0.000, 0.000] | n/a | 0.00 [0.00, 0.00] | 1.0000 |
| gate − none | Blocking-only AHS slope per step | 54 | 0.000 | 0.000 | 0.000 | [0.000, 0.000] | n/a | n/a n/a | 1.0000 |
| daedalus-mcp − none | Blocking-only AHS slope per step | 54 | 0.000 | 0.000 | 0.000 | [0.000, 0.000] | n/a | n/a n/a | 1.0000 |
| gate − none | Blocking-only AHS area under the curve (trapezoid, per step) | 54 | 1.000 | 1.000 | 0.000 | [0.000, 0.000] | n/a | 0.00 [0.00, 0.00] | 1.0000 |
| daedalus-mcp − none | Blocking-only AHS area under the curve (trapezoid, per step) | 54 | 1.000 | 1.000 | 0.000 | [0.000, 0.000] | n/a | 0.00 [0.00, 0.00] | 1.0000 |
| gate − none | LOC at step k (guard: feature dropping) | 54 | 2009.389 | 1996.019 | 13.370 | [-250.482, 288.172] | 0.02 | -0.01 [-0.16, 0.12] | 0.8947 |
| daedalus-mcp − none | LOC at step k (guard: feature dropping) | 54 | 2012.185 | 1996.019 | 16.167 | [-239.821, 278.044] | 0.02 | -0.01 [-0.15, 0.11] | 0.8741 |
| gate − none | Source files at step k (guard: feature dropping) | 54 | 57.426 | 57.037 | 0.389 | [-7.372, 8.185] | 0.02 | -0.01 [-0.16, 0.12] | 0.8937 |
| daedalus-mcp − none | Source files at step k (guard: feature dropping) | 54 | 57.481 | 57.037 | 0.444 | [-7.057, 8.020] | 0.02 | -0.01 [-0.17, 0.12] | 0.8842 |
| gate − none | Type-check errors per step (guard) | 54 | 0.189 | 0.133 | 0.056 | [-0.026, 0.137] | 0.22 | -0.42 [-1.39, 0.14] | 0.1488 |
| daedalus-mcp − none | Type-check errors per step (guard) | 54 | 0.189 | 0.133 | 0.056 | [-0.033, 0.144] | 0.22 | -0.42 [-1.57, 0.18] | 0.1418 |

## T7. Gate repair success (descriptive)

| Gate steps | Failing steps (repair ran) | Repairs with an evaluated outcome | Cleared | Share cleared [Wilson 95%] | Share cleared [task-cluster 95%] | Mean blocking before − after [95%] | Findings introduced by repairs | Repair evaluation failed |
|---|---|---|---|---|---|---|---|---|
| 270 | 0 | 0 | 0 | n/a n/a | n/a | n/a | 0 | 0 |

## T8. Cost and time (descriptive, task-cluster bootstrap 95%)

| Arm | Steps | Steps with a cost | USD per step | USD per run (runs with every cost) | Input tokens per step | Output tokens per step | Wall minutes per step | Agent turns per step | Repair turns | Repair USD | Usage-limit interruptions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| none | 270 | 180 | 3.21 [2.96, 3.49] | 16.03 [14.89, 17.13] | 64235 [60923, 67707] | 10466 [9870, 11127] | 4.3 [4.0, 4.7] | 15.1 [14.5, 15.7] | 0 | 0.00 | 0 |
| daedalus-mcp | 270 | 180 | 3.22 [3.03, 3.41] | 16.12 [15.32, 16.92] | 63293 [60147, 66847] | 9907 [9350, 10501] | 4.3 [4.1, 4.6] | 15.1 [14.5, 15.7] | 0 | 0.00 | 0 |
| gate | 270 | 180 | 3.32 [3.03, 3.61] | 16.59 [15.13, 18.05] | 63313 [60424, 66429] | 9818 [9206, 10452] | 4.2 [4.0, 4.5] | 15.0 [14.5, 15.5] | 0 | 0.00 | 0 |

## T9. Guards (descriptive)

| Arm | Steps | Evaluation errors | Steps with type-check errors | Mean type-check errors | Skeleton broken | Non-completed turns | Mean LOC step 1 | Mean LOC step k | Mean files step k | Runs with a LOC drop |
|---|---|---|---|---|---|---|---|---|---|---|
| none | 270 | 2 | 35 | 0.13 | 1 | 12 | 599 | 1996 | 57.0 | 0 |
| daedalus-mcp | 270 | 4 | 47 | 0.19 | 1 | 10 | 604 | 2012 | 57.5 | 0 |
| gate | 270 | 3 | 49 | 0.19 | 1 | 8 | 603 | 2009 | 57.4 | 0 |

## T10. Missingness per model and arm

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

| Arm | Step | n | Primary outcome per step | Blocking per step | AHS |
|---|---|---|---|---|---|
| none | 1 | 53 | 31.611 [29.354, 33.868] | 0.000 | 0.925 |
| none | 2 | 54 | 31.809 [29.593, 34.024] | 0.000 | 0.881 |
| none | 3 | 54 | 30.221 [28.469, 31.974] | 0.000 | 0.843 |
| none | 4 | 53 | 32.541 [30.853, 34.229] | 0.000 | 0.787 |
| none | 5 | 54 | 32.351 [30.335, 34.366] | 0.000 | 0.744 |
| daedalus-mcp | 1 | 52 | 32.775 [29.780, 35.770] | 0.000 | 0.921 |
| daedalus-mcp | 2 | 53 | 32.073 [29.638, 34.509] | 0.000 | 0.877 |
| daedalus-mcp | 3 | 54 | 34.154 [31.163, 37.144] | 0.000 | 0.822 |
| daedalus-mcp | 4 | 54 | 33.019 [30.733, 35.306] | 0.000 | 0.780 |
| daedalus-mcp | 5 | 53 | 32.438 [30.470, 34.406] | 0.000 | 0.737 |
| gate | 1 | 54 | 30.813 [28.273, 33.354] | 0.000 | 0.926 |
| gate | 2 | 54 | 32.432 [30.372, 34.492] | 0.000 | 0.877 |
| gate | 3 | 54 | 32.427 [30.081, 34.773] | 0.000 | 0.833 |
| gate | 4 | 54 | 31.830 [29.955, 33.706] | 0.000 | 0.788 |
| gate | 5 | 51 | 33.899 [31.370, 36.429] | 0.000 | 0.728 |

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
