# Study 2 analysis rehearsal: summary (SYNTHETIC; not a pre-registration)

Seed 20261016. Planned design: 6 tasks × 3 models × 3 replicates × 3 arms, k = 5 (outline §6; power notes option B). Pilot: 3 tasks × none/gate , k = 4.

## Checks per scenario

| Scenario | Check | Result | Detail |
|---|---|---|---|
| null | switch rule: pilot shows erosion → primary stays blocking | PASS | Pilot memo §3: erosion EXISTS (new blocking findings after step 1 in 3 of 3 tasks). Per memo §5 the Study 2 primary outcome stays the blocking erosion slope. |
| null | null: no confirmatory contrast rejected under Holm | PASS | gate: Holm p 1.000; daedalus-mcp: Holm p 1.000 |
| null | null: gate − none CI contains 0 | PASS | CI [-0.300, 0.534] |
| null | null: daedalus-mcp − none CI contains 0 | PASS | CI [-0.426, 0.341] |
| null | gate − none: 95% CI of the mean slope difference covers the generating value | PASS | truth 0.086, estimate 0.105, CI [-0.300, 0.534] |
| null | daedalus-mcp − none: 95% CI of the mean slope difference covers the generating value | PASS | truth -0.049, estimate -0.039, CI [-0.426, 0.341] |
| small | switch rule: pilot shows erosion → primary stays blocking | PASS | Pilot memo §3: erosion EXISTS (new blocking findings after step 1 in 3 of 3 tasks). Per memo §5 the Study 2 primary outcome stays the blocking erosion slope. |
| small | gate − none: 95% CI of the mean slope difference covers the generating value | PASS | truth -0.090, estimate -0.094, CI [-0.593, 0.361] |
| small | gate − none: estimate has the planted sign (less erosion) | PASS | estimate -0.094 |
| small | gate − none: 95% CI of the relative reduction covers the planted reduction | PASS | planted 0.200, estimate 0.112, CI [-0.634, 0.508] |
| small | daedalus-mcp − none: 95% CI of the mean slope difference covers the generating value | PASS | truth -0.214, estimate -0.101, CI [-0.689, 0.374] |
| small | daedalus-mcp − none: estimate has the planted sign (less erosion) | PASS | estimate -0.101 |
| small | daedalus-mcp − none: 95% CI of the relative reduction covers the planted reduction | PASS | planted 0.100, estimate 0.120, CI [-0.801, 0.541] |
| expected | switch rule: pilot shows erosion → primary stays blocking | PASS | Pilot memo §3: erosion EXISTS (new blocking findings after step 1 in 2 of 3 tasks). Per memo §5 the Study 2 primary outcome stays the blocking erosion slope. |
| expected | gate − none: 95% CI of the mean slope difference covers the generating value | PASS | truth -0.510, estimate -0.705, CI [-1.942, 0.061] |
| expected | gate − none: estimate has the planted sign (less erosion) | PASS | estimate -0.705 |
| expected | gate − none: 95% CI of the relative reduction covers the planted reduction | PASS | planted 0.500, estimate 0.604, CI [-0.125, 0.789] |
| expected | daedalus-mcp − none: 95% CI of the mean slope difference covers the generating value | PASS | truth -0.287, estimate -0.632, CI [-1.848, 0.060] |
| expected | daedalus-mcp − none: estimate has the planted sign (less erosion) | PASS | estimate -0.632 |
| expected | daedalus-mcp − none: 95% CI of the relative reduction covers the planted reduction | PASS | planted 0.250, estimate 0.542, CI [-0.104, 0.770] |
| floor | switch rule: pilot primary outcome is zero → pre-committed fallback triggered | PASS | Pilot memo §3: the primary outcome is ZERO (no new blocking finding after step 1 in any of 3 tasks). Per memo §5 the PRE-COMMITTED FALLBACK applies: the Study 2 primary outcome moves to the advisory-tier erosion rate (per-run slope of advisory findings per KLOC, FF-CV05 excluded). |
| floor | primary outcome moved to the advisory-tier erosion rate | PASS | advisoryExclCv05PerKlocSlope |
| floor | the report says so (statement names the fallback) | PASS | T1 of report.md |
| floor | fallback outcome computed as defined (FF-CV05 excluded) | PASS | advisoryByRule present on every evaluated step |
| floor | gate − none: 95% CI of the mean slope difference covers the generating value | PASS | truth -0.100, estimate 0.173, CI [-0.547, 0.851] |
| floor | daedalus-mcp − none: 95% CI of the mean slope difference covers the generating value | PASS | truth -0.018, estimate 0.033, CI [-0.896, 0.790] |
| floor-pre-142 | switch rule: pilot primary outcome is zero → pre-committed fallback triggered | PASS | Pilot memo §3: the primary outcome is ZERO (no new blocking finding after step 1 in any of 3 tasks). Per memo §5 the PRE-COMMITTED FALLBACK applies: the Study 2 primary outcome moves to the advisory-tier erosion rate (per-run slope of advisory findings per KLOC, FF-CV05 excluded). |
| floor-pre-142 | primary outcome moved to the advisory-tier erosion rate | PASS | advisoryTotalPerKlocSlope |
| floor-pre-142 | the report says so (statement names the fallback) | PASS | T1 of report.md |
| floor-pre-142 | pre-#142 records: the report says the defined fallback is NOT computable (no per-rule advisory counts) | PASS | The memo §5 fallback outcome (advisory per KLOC WITHOUT FF-CV05) is NOT computable from these step records: these records carry only `advisoryViolationCount`, no `advisoryByRule` (records written before PR #142, or by an evaluator that omits it; readiness gate S6). The table below uses ALL advisory rules, FF-CV05 included, as a labelled surrogate; it is not the pre-committed outcome. |

## Power at the planned N (power simulation, design B, 400 simulated studies, block-level sign-flip, Holm)

| Scenario | Outcome | Power gate | Power mcp | Power either | MC SE ≤ |
|---|---|---|---|---|---|
| null | blocking | 0.04 | 0.04 | 0.07 | 0.03 |
| small | blocking | 0.09 | 0.04 | 0.11 | 0.03 |
| expected | blocking | 0.54 | 0.17 | 0.55 | 0.03 |
| floor | advisory-per-kloc | 0.05 | 0.02 | 0.06 | 0.03 |

## Monte Carlo seed sensitivity (scenario expected, data seed 20261016, analysis seeds 1–8, 9999 flips)

| Analysis seed | gate Holm p | gate rejected | mcp Holm p | mcp rejected |
|---|---|---|---|---|
| 1 | 0.0086 | yes | 0.0526 | no |
| 2 | 0.0068 | yes | 0.0461 | yes |
| 3 | 0.0058 | yes | 0.0504 | no |
| 4 | 0.0076 | yes | 0.0500 | yes |
| 5 | 0.0074 | yes | 0.0494 | yes |
| 6 | 0.0088 | yes | 0.0516 | no |
| 7 | 0.0068 | yes | 0.0500 | yes |
| 8 | 0.0062 | yes | 0.0494 | yes |

## Calibration per scale and inference method (plan mode; 200 synthetic studies per scenario; 999 resamples, 1999 flips; exact sign-flip at ≤ 20 units)

Rates over the simulated studies. Under `null` every rate is the test size. Coverage of the generating value is shown for the raw (and advisory) scale only: the generator's truth file has no per-KLOC slope.

| Scenario | Scale | Contrast | Sign-flip, Holm | Sign-flip, unadjusted | Bootstrap CI excludes 0 | Disagree (CI vs p) | CI covers truth |
|---|---|---|---|---|---|---|---|
| null | raw | gate − none | 0.03 | 0.07 | 0.03 | 0.04 | 0.98 |
| null | raw | daedalus-mcp − none | 0.01 | 0.03 | 0.01 | 0.03 | 0.97 |
| null | perKloc | gate − none | 0.03 | 0.04 | 0.02 | 0.03 | n/a |
| null | perKloc | daedalus-mcp − none | 0.04 | 0.05 | 0.03 | 0.03 | n/a |
| small | raw | gate − none | 0.13 | 0.17 | 0.10 | 0.09 | 0.99 |
| small | raw | daedalus-mcp − none | 0.07 | 0.09 | 0.05 | 0.04 | 0.98 |
| small | perKloc | gate − none | 0.07 | 0.09 | 0.04 | 0.05 | n/a |
| small | perKloc | daedalus-mcp − none | 0.06 | 0.07 | 0.05 | 0.02 | n/a |
| expected | raw | gate − none | 0.59 | 0.67 | 0.54 | 0.14 | 0.99 |
| expected | raw | daedalus-mcp − none | 0.21 | 0.23 | 0.13 | 0.11 | 0.98 |
| expected | perKloc | gate − none | 0.28 | 0.37 | 0.20 | 0.17 | n/a |
| expected | perKloc | daedalus-mcp − none | 0.10 | 0.13 | 0.07 | 0.07 | n/a |
| floor | advisory | gate − none | 0.04 | 0.05 | 0.02 | 0.04 | 0.99 |
| floor | advisory | daedalus-mcp − none | 0.03 | 0.05 | 0.03 | 0.04 | 0.97 |

## Decision stability across 10 seeds (scenario null; seeds 20261016..20261025; same data)

Exact enumeration must give identical p on every seed. Monte Carlo p varies with the seed; the plan file fixes which seed is used. The p columns hold the Holm p on T2/T2b rows (the p their decision uses) and the unadjusted p on T3 and T5 rows; the Scope column says which. A Holm p capped at 1 reads as identical on every seed even when the Monte Carlo p underneath varies.

| Scope | Contrast | Units | Test | p min | p max | Identical on every seed | Seeds rejecting (at α, on that p) |
|---|---|---|---|---|---|---|---|
| T2b raw (Holm p) | gate − none | 54 | Monte Carlo sign-flip | 1.0000 | 1.0000 | yes | 0 of 10 |
| T2b raw (Holm p) | daedalus-mcp − none | 54 | Monte Carlo sign-flip | 1.0000 | 1.0000 | yes | 0 of 10 |
| T2b perKloc (Holm p) | gate − none | 54 | Monte Carlo sign-flip | 1.0000 | 1.0000 | yes | 0 of 10 |
| T2b perKloc (Holm p) | daedalus-mcp − none | 54 | Monte Carlo sign-flip | 1.0000 | 1.0000 | yes | 0 of 10 |
| T3 task level (unadjusted p) | gate − none | 6 | exact sign-flip | 0.4063 | 0.4063 | yes | 0 of 10 |
| T3 task level (unadjusted p) | daedalus-mcp − none | 6 | exact sign-flip | 0.8125 | 0.8125 | yes | 0 of 10 |
| T5 claude-code-cli/synth-model-a (unadjusted p) | gate − none | 18 | exact sign-flip | 0.9647 | 0.9647 | yes | 0 of 10 |
| T5 claude-code-cli/synth-model-a (unadjusted p) | daedalus-mcp − none | 18 | exact sign-flip | 0.9516 | 0.9516 | yes | 0 of 10 |
| T5 claude-code-cli/synth-model-b (unadjusted p) | gate − none | 18 | exact sign-flip | 0.7278 | 0.7278 | yes | 0 of 10 |
| T5 claude-code-cli/synth-model-b (unadjusted p) | daedalus-mcp − none | 18 | exact sign-flip | 0.6170 | 0.6170 | yes | 0 of 10 |
| T5 codex-cli/synth-model-c (unadjusted p) | gate − none | 18 | exact sign-flip | 0.5157 | 0.5157 | yes | 0 of 10 |
| T5 codex-cli/synth-model-c (unadjusted p) | daedalus-mcp − none | 18 | exact sign-flip | 0.8291 | 0.8291 | yes | 0 of 10 |

## Decision stability across 10 seeds (scenario expected; seeds 20261016..20261025; same data)

Exact enumeration must give identical p on every seed. Monte Carlo p varies with the seed; the plan file fixes which seed is used. The p columns hold the Holm p on T2/T2b rows (the p their decision uses) and the unadjusted p on T3 and T5 rows; the Scope column says which. A Holm p capped at 1 reads as identical on every seed even when the Monte Carlo p underneath varies.

| Scope | Contrast | Units | Test | p min | p max | Identical on every seed | Seeds rejecting (at α, on that p) |
|---|---|---|---|---|---|---|---|
| T2b raw (Holm p) | gate − none | 54 | Monte Carlo sign-flip | 0.0062 | 0.0100 | NO | 10 of 10 |
| T2b raw (Holm p) | daedalus-mcp − none | 54 | Monte Carlo sign-flip | 0.0463 | 0.0560 | NO | 4 of 10 |
| T2b perKloc (Holm p) | gate − none | 54 | Monte Carlo sign-flip | 0.2022 | 0.2168 | NO | 0 of 10 |
| T2b perKloc (Holm p) | daedalus-mcp − none | 54 | Monte Carlo sign-flip | 0.2022 | 0.2168 | NO | 0 of 10 |
| T3 task level (unadjusted p) | gate − none | 6 | exact sign-flip | 0.1563 | 0.1563 | yes | 0 of 10 |
| T3 task level (unadjusted p) | daedalus-mcp − none | 6 | exact sign-flip | 0.1250 | 0.1250 | yes | 0 of 10 |
| T5 claude-code-cli/synth-model-a (unadjusted p) | gate − none | 18 | exact sign-flip | 0.1287 | 0.1287 | yes | 0 of 10 |
| T5 claude-code-cli/synth-model-a (unadjusted p) | daedalus-mcp − none | 18 | exact sign-flip | 0.2767 | 0.2767 | yes | 0 of 10 |
| T5 claude-code-cli/synth-model-b (unadjusted p) | gate − none | 18 | exact sign-flip | 0.1867 | 0.1867 | yes | 0 of 10 |
| T5 claude-code-cli/synth-model-b (unadjusted p) | daedalus-mcp − none | 18 | exact sign-flip | 0.3639 | 0.3639 | yes | 0 of 10 |
| T5 codex-cli/synth-model-c (unadjusted p) | gate − none | 18 | exact sign-flip | 0.0563 | 0.0563 | yes | 0 of 10 |
| T5 codex-cli/synth-model-c (unadjusted p) | daedalus-mcp − none | 18 | exact sign-flip | 0.1898 | 0.1898 | yes | 0 of 10 |
