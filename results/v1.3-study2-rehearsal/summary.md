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
| floor | primary outcome moved to the advisory-tier erosion rate | PASS | advisoryTotalPerKlocSlope |
| floor | the report says so (statement names the fallback) | PASS | T1 of report.md |
| floor | v1.3 format: the report says the defined fallback is NOT computable (no per-rule advisory counts) | PASS | The memo §5 fallback outcome (advisory per KLOC WITHOUT FF-CV05) is NOT computable from these step records: the v1.3 `StepEvaluation` has only `advisoryViolationCount`, no per-rule advisory counts (readiness gate S6; PR #142 proposes `advisoryByRule`). The table below uses ALL advisory rules, FF-CV05 included, as a labelled surrogate; it is not the pre-committed outcome. |
| floor-advisory-by-rule | switch rule: pilot primary outcome is zero → pre-committed fallback triggered | PASS | Pilot memo §3: the primary outcome is ZERO (no new blocking finding after step 1 in any of 3 tasks). Per memo §5 the PRE-COMMITTED FALLBACK applies: the Study 2 primary outcome moves to the advisory-tier erosion rate (per-run slope of advisory findings per KLOC, FF-CV05 excluded). |
| floor-advisory-by-rule | primary outcome moved to the advisory-tier erosion rate | PASS | advisoryExclCv05PerKlocSlope |
| floor-advisory-by-rule | the report says so (statement names the fallback) | PASS | T1 of report.md |
| floor-advisory-by-rule | fallback outcome computed as defined (FF-CV05 excluded) | PASS | advisoryByRule present on every evaluated step |
| floor-advisory-by-rule | gate − none: 95% CI of the mean slope difference covers the generating value | PASS | truth -0.100, estimate 0.173, CI [-0.547, 0.851] |
| floor-advisory-by-rule | daedalus-mcp − none: 95% CI of the mean slope difference covers the generating value | PASS | truth -0.018, estimate 0.033, CI [-0.896, 0.790] |

## Power at the planned N (power simulation, design B, 400 simulated studies, block-level sign-flip, Holm)

| Scenario | Outcome | Power gate | Power mcp | Power either | MC SE ≤ |
|---|---|---|---|---|---|
| null | blocking | 0.04 | 0.04 | 0.07 | 0.03 |
| small | blocking | 0.09 | 0.04 | 0.11 | 0.03 |
| expected | blocking | 0.54 | 0.17 | 0.55 | 0.03 |
| floor | advisory-per-kloc | 0.05 | 0.02 | 0.06 | 0.03 |

## Calibration of the full pipeline (200 synthetic studies per scenario; generator → analysis; 999 resamples, 1999 flips)

| Scenario | Holm reject gate | Holm reject mcp | CI covers truth (gate) | CI covers truth (mcp) | Rel. reduction CI covers planted (gate) | Mean estimate gate | Mean truth gate | Sign-flip and bootstrap CI disagree (gate) |
|---|---|---|---|---|---|---|---|---|
| null | 0.04 | 0.02 | 0.98 | 0.97 | 0.97 | 0.011 | -0.002 | 0.04 |
| small | 0.14 | 0.07 | 0.99 | 0.98 | 0.97 | -0.282 | -0.263 | 0.07 |
| expected | 0.60 | 0.20 | 0.99 | 0.98 | 0.99 | -0.668 | -0.659 | 0.13 |
| floor | 0.03 | 0.03 | 0.99 | 0.97 | 0.99 | -0.389 | -0.336 | 0.04 |
