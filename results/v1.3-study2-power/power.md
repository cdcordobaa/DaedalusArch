# Study 2 power simulation (informal design aid, not a pre-registration)

Seed 20261015, 400 simulated studies per cell, 999 sign flips where not exact. Holm over the two contrasts at α = 0.05 (two-sided). Monte Carlo SE of a power estimate ≤ 0.03.

## Assumptions

- Blocking violations at step 1 (arm none): mean 1.5; new blocking violations per step: mean 1.
- Log-scale heterogeneity (SD): task 0.5, model 0.3, run 0.4; task slope 0.3.
- Counts: negative binomial, size θ = 2 (variance μ + μ²/θ).
- Effect: relative reduction of the erosion slope per arm (grid below); arm × task interaction SD 0.15.
- Fallback outcome: advisory violations per KLOC, 6 at step 1 plus 1 per step; size 0.6 KLOC after step 1 plus 0.35 KLOC per step (lognormal SD 0.25); the arms reach the advisory rules at 0.5 × the blocking effect.

## Outcome: erosion slope of blocking violations

| Design | Blocks | Runs | Step turns | Effect gate / mcp | Power gate (block) | Power mcp (block) | Power any (block) | Mean abs. d_z gate | Normal approx. | Power gate (task-level) | Min p (task-level) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A: 6 tasks × 2 models × 3 reps, k = 5 | 36 | 108 | 540 | 0 / 0 | 0.03 | 0.02 | 0.04 | 0.14 | 0.08 | 0.00 | 0.031 |
| A: 6 tasks × 2 models × 3 reps, k = 5 | 36 | 108 | 540 | 0.2 / 0.1 | 0.06 | 0.05 | 0.09 | 0.17 | 0.11 | 0.00 | 0.031 |
| A: 6 tasks × 2 models × 3 reps, k = 5 | 36 | 108 | 540 | 0.35 / 0.2 | 0.21 | 0.07 | 0.22 | 0.25 | 0.23 | 0.00 | 0.031 |
| A: 6 tasks × 2 models × 3 reps, k = 5 | 36 | 108 | 540 | 0.5 / 0.25 | 0.37 | 0.11 | 0.38 | 0.32 | 0.38 | 0.00 | 0.031 |
| A: 6 tasks × 2 models × 3 reps, k = 5 | 36 | 108 | 540 | 0.5 / 0.5 | 0.43 | 0.42 | 0.55 | 0.33 | 0.41 | 0.00 | 0.031 |
| B: 6 × 3 × 3, k = 5 (outline working grid) | 54 | 162 | 810 | 0 / 0 | 0.04 | 0.02 | 0.05 | 0.11 | 0.07 | 0.00 | 0.031 |
| B: 6 × 3 × 3, k = 5 (outline working grid) | 54 | 162 | 810 | 0.2 / 0.1 | 0.11 | 0.03 | 0.13 | 0.15 | 0.13 | 0.00 | 0.031 |
| B: 6 × 3 × 3, k = 5 (outline working grid) | 54 | 162 | 810 | 0.35 / 0.2 | 0.28 | 0.12 | 0.32 | 0.23 | 0.29 | 0.00 | 0.031 |
| B: 6 × 3 × 3, k = 5 (outline working grid) | 54 | 162 | 810 | 0.5 / 0.25 | 0.54 | 0.18 | 0.55 | 0.33 | 0.57 | 0.00 | 0.031 |
| B: 6 × 3 × 3, k = 5 (outline working grid) | 54 | 162 | 810 | 0.5 / 0.5 | 0.61 | 0.61 | 0.72 | 0.32 | 0.54 | 0.00 | 0.031 |
| C: 6 × 3 × 5, k = 5 | 90 | 270 | 1350 | 0 / 0 | 0.04 | 0.04 | 0.07 | 0.09 | 0.09 | 0.00 | 0.031 |
| C: 6 × 3 × 5, k = 5 | 90 | 270 | 1350 | 0.2 / 0.1 | 0.15 | 0.08 | 0.19 | 0.13 | 0.17 | 0.00 | 0.031 |
| C: 6 × 3 × 5, k = 5 | 90 | 270 | 1350 | 0.35 / 0.2 | 0.48 | 0.20 | 0.51 | 0.23 | 0.46 | 0.00 | 0.031 |
| C: 6 × 3 × 5, k = 5 | 90 | 270 | 1350 | 0.5 / 0.25 | 0.77 | 0.33 | 0.79 | 0.32 | 0.78 | 0.00 | 0.031 |
| C: 6 × 3 × 5, k = 5 | 90 | 270 | 1350 | 0.5 / 0.5 | 0.81 | 0.81 | 0.90 | 0.32 | 0.79 | 0.00 | 0.031 |
| D: 6 × 3 × 3, k = 4 | 54 | 162 | 648 | 0 / 0 | 0.04 | 0.04 | 0.06 | 0.12 | 0.08 | 0.00 | 0.031 |
| D: 6 × 3 × 3, k = 4 | 54 | 162 | 648 | 0.2 / 0.1 | 0.07 | 0.05 | 0.10 | 0.14 | 0.12 | 0.00 | 0.031 |
| D: 6 × 3 × 3, k = 4 | 54 | 162 | 648 | 0.35 / 0.2 | 0.17 | 0.09 | 0.18 | 0.18 | 0.18 | 0.00 | 0.031 |
| D: 6 × 3 × 3, k = 4 | 54 | 162 | 648 | 0.5 / 0.25 | 0.36 | 0.11 | 0.38 | 0.26 | 0.38 | 0.00 | 0.031 |
| D: 6 × 3 × 3, k = 4 | 54 | 162 | 648 | 0.5 / 0.5 | 0.39 | 0.41 | 0.51 | 0.26 | 0.38 | 0.00 | 0.031 |
| E: 6 × 3 × 3, k = 6 | 54 | 162 | 972 | 0 / 0 | 0.04 | 0.04 | 0.07 | 0.12 | 0.08 | 0.00 | 0.031 |
| E: 6 × 3 × 3, k = 6 | 54 | 162 | 972 | 0.2 / 0.1 | 0.13 | 0.04 | 0.14 | 0.17 | 0.16 | 0.00 | 0.031 |
| E: 6 × 3 × 3, k = 6 | 54 | 162 | 972 | 0.35 / 0.2 | 0.38 | 0.15 | 0.42 | 0.25 | 0.35 | 0.00 | 0.031 |
| E: 6 × 3 × 3, k = 6 | 54 | 162 | 972 | 0.5 / 0.25 | 0.71 | 0.26 | 0.72 | 0.37 | 0.68 | 0.00 | 0.031 |
| E: 6 × 3 × 3, k = 6 | 54 | 162 | 972 | 0.5 / 0.5 | 0.72 | 0.70 | 0.83 | 0.36 | 0.66 | 0.00 | 0.031 |
| F: 12 × 3 × 2, k = 5 (hypothetical: 6 tasks beyond the sealed list) | 72 | 216 | 1080 | 0 / 0 | 0.02 | 0.01 | 0.03 | 0.09 | 0.07 | 0.02 | 0.000 |
| F: 12 × 3 × 2, k = 5 (hypothetical: 6 tasks beyond the sealed list) | 72 | 216 | 1080 | 0.2 / 0.1 | 0.10 | 0.06 | 0.14 | 0.13 | 0.13 | 0.07 | 0.000 |
| F: 12 × 3 × 2, k = 5 (hypothetical: 6 tasks beyond the sealed list) | 72 | 216 | 1080 | 0.35 / 0.2 | 0.35 | 0.15 | 0.38 | 0.22 | 0.35 | 0.34 | 0.000 |
| F: 12 × 3 × 2, k = 5 (hypothetical: 6 tasks beyond the sealed list) | 72 | 216 | 1080 | 0.5 / 0.25 | 0.66 | 0.21 | 0.67 | 0.32 | 0.67 | 0.58 | 0.000 |
| F: 12 × 3 × 2, k = 5 (hypothetical: 6 tasks beyond the sealed list) | 72 | 216 | 1080 | 0.5 / 0.5 | 0.76 | 0.74 | 0.85 | 0.33 | 0.70 | 0.58 | 0.000 |

## Outcome: fallback: advisory violations per KLOC, slope

| Design | Blocks | Runs | Step turns | Effect gate / mcp | Power gate (block) | Power mcp (block) | Power any (block) | Mean abs. d_z gate | Normal approx. | Power gate (task-level) | Min p (task-level) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A: 6 tasks × 2 models × 3 reps, k = 5 | 36 | 108 | 540 | 0 / 0 | 0.03 | 0.03 | 0.05 | 0.14 | 0.08 | 0.00 | 0.031 |
| A: 6 tasks × 2 models × 3 reps, k = 5 | 36 | 108 | 540 | 0.2 / 0.1 | 0.03 | 0.02 | 0.04 | 0.14 | 0.08 | 0.00 | 0.031 |
| A: 6 tasks × 2 models × 3 reps, k = 5 | 36 | 108 | 540 | 0.35 / 0.2 | 0.04 | 0.02 | 0.05 | 0.14 | 0.08 | 0.00 | 0.031 |
| A: 6 tasks × 2 models × 3 reps, k = 5 | 36 | 108 | 540 | 0.5 / 0.25 | 0.04 | 0.03 | 0.06 | 0.15 | 0.09 | 0.00 | 0.031 |
| A: 6 tasks × 2 models × 3 reps, k = 5 | 36 | 108 | 540 | 0.5 / 0.5 | 0.05 | 0.06 | 0.09 | 0.15 | 0.09 | 0.00 | 0.031 |
| B: 6 × 3 × 3, k = 5 (outline working grid) | 54 | 162 | 810 | 0 / 0 | 0.03 | 0.03 | 0.06 | 0.11 | 0.07 | 0.00 | 0.031 |
| B: 6 × 3 × 3, k = 5 (outline working grid) | 54 | 162 | 810 | 0.2 / 0.1 | 0.03 | 0.03 | 0.05 | 0.11 | 0.07 | 0.00 | 0.031 |
| B: 6 × 3 × 3, k = 5 (outline working grid) | 54 | 162 | 810 | 0.35 / 0.2 | 0.03 | 0.02 | 0.04 | 0.12 | 0.09 | 0.00 | 0.031 |
| B: 6 × 3 × 3, k = 5 (outline working grid) | 54 | 162 | 810 | 0.5 / 0.25 | 0.05 | 0.04 | 0.08 | 0.13 | 0.11 | 0.00 | 0.031 |
| B: 6 × 3 × 3, k = 5 (outline working grid) | 54 | 162 | 810 | 0.5 / 0.5 | 0.07 | 0.06 | 0.11 | 0.13 | 0.10 | 0.00 | 0.031 |
| C: 6 × 3 × 5, k = 5 | 90 | 270 | 1350 | 0 / 0 | 0.02 | 0.02 | 0.03 | 0.09 | 0.08 | 0.00 | 0.031 |
| C: 6 × 3 × 5, k = 5 | 90 | 270 | 1350 | 0.2 / 0.1 | 0.04 | 0.03 | 0.06 | 0.08 | 0.07 | 0.00 | 0.031 |
| C: 6 × 3 × 5, k = 5 | 90 | 270 | 1350 | 0.35 / 0.2 | 0.06 | 0.04 | 0.08 | 0.10 | 0.09 | 0.00 | 0.031 |
| C: 6 × 3 × 5, k = 5 | 90 | 270 | 1350 | 0.5 / 0.25 | 0.08 | 0.04 | 0.10 | 0.11 | 0.11 | 0.00 | 0.031 |
| C: 6 × 3 × 5, k = 5 | 90 | 270 | 1350 | 0.5 / 0.5 | 0.07 | 0.07 | 0.10 | 0.10 | 0.10 | 0.00 | 0.031 |
| D: 6 × 3 × 3, k = 4 | 54 | 162 | 648 | 0 / 0 | 0.04 | 0.04 | 0.07 | 0.11 | 0.08 | 0.00 | 0.031 |
| D: 6 × 3 × 3, k = 4 | 54 | 162 | 648 | 0.2 / 0.1 | 0.03 | 0.04 | 0.07 | 0.11 | 0.08 | 0.00 | 0.031 |
| D: 6 × 3 × 3, k = 4 | 54 | 162 | 648 | 0.35 / 0.2 | 0.03 | 0.03 | 0.05 | 0.12 | 0.08 | 0.00 | 0.031 |
| D: 6 × 3 × 3, k = 4 | 54 | 162 | 648 | 0.5 / 0.25 | 0.05 | 0.04 | 0.08 | 0.12 | 0.09 | 0.00 | 0.031 |
| D: 6 × 3 × 3, k = 4 | 54 | 162 | 648 | 0.5 / 0.5 | 0.06 | 0.04 | 0.08 | 0.14 | 0.11 | 0.00 | 0.031 |
| E: 6 × 3 × 3, k = 6 | 54 | 162 | 972 | 0 / 0 | 0.03 | 0.03 | 0.05 | 0.10 | 0.07 | 0.00 | 0.031 |
| E: 6 × 3 × 3, k = 6 | 54 | 162 | 972 | 0.2 / 0.1 | 0.04 | 0.04 | 0.07 | 0.12 | 0.09 | 0.00 | 0.031 |
| E: 6 × 3 × 3, k = 6 | 54 | 162 | 972 | 0.35 / 0.2 | 0.04 | 0.03 | 0.06 | 0.12 | 0.09 | 0.00 | 0.031 |
| E: 6 × 3 × 3, k = 6 | 54 | 162 | 972 | 0.5 / 0.25 | 0.06 | 0.04 | 0.08 | 0.14 | 0.11 | 0.00 | 0.031 |
| E: 6 × 3 × 3, k = 6 | 54 | 162 | 972 | 0.5 / 0.5 | 0.08 | 0.07 | 0.13 | 0.14 | 0.11 | 0.00 | 0.031 |
| F: 12 × 3 × 2, k = 5 (hypothetical: 6 tasks beyond the sealed list) | 72 | 216 | 1080 | 0 / 0 | 0.03 | 0.03 | 0.04 | 0.10 | 0.08 | 0.01 | 0.000 |
| F: 12 × 3 × 2, k = 5 (hypothetical: 6 tasks beyond the sealed list) | 72 | 216 | 1080 | 0.2 / 0.1 | 0.03 | 0.02 | 0.04 | 0.10 | 0.08 | 0.03 | 0.000 |
| F: 12 × 3 × 2, k = 5 (hypothetical: 6 tasks beyond the sealed list) | 72 | 216 | 1080 | 0.35 / 0.2 | 0.04 | 0.04 | 0.06 | 0.10 | 0.08 | 0.06 | 0.000 |
| F: 12 × 3 × 2, k = 5 (hypothetical: 6 tasks beyond the sealed list) | 72 | 216 | 1080 | 0.5 / 0.25 | 0.04 | 0.04 | 0.06 | 0.10 | 0.09 | 0.06 | 0.000 |
| F: 12 × 3 × 2, k = 5 (hypothetical: 6 tasks beyond the sealed list) | 72 | 216 | 1080 | 0.5 / 0.5 | 0.07 | 0.07 | 0.11 | 0.12 | 0.11 | 0.06 | 0.000 |

## Sensitivity (design B, gate halves the slope, mcp quarters it; block analysis)

| Assumption changed | Outcome | Power gate | Power mcp | Mean abs. d_z gate |
|---|---|---|---|---|
| Poisson counts (no overdispersion) | blocking | 0.94 | 0.51 | 0.56 |
| Strong overdispersion (θ = 0.8) | blocking | 0.31 | 0.09 | 0.24 |
| No arm × task interaction (sdEffectTask = 0) | blocking | 0.55 | 0.19 | 0.32 |
| Large arm × task interaction (sdEffectTask = 0.35) | blocking | 0.48 | 0.18 | 0.30 |
| Slow erosion (slopePerStep = 0.5) | blocking | 0.27 | 0.09 | 0.22 |
| Fast erosion (slopePerStep = 2) | blocking | 0.77 | 0.30 | 0.40 |
| Noisy runs (sdRun = 0.7) | blocking | 0.42 | 0.17 | 0.27 |
| Advisory: full spillover (advisorySpillover = 1) | advisory-per-kloc | 0.14 | 0.07 | 0.18 |
| Advisory: steep erosion (3 per KLOC per step) and full spillover | advisory-per-kloc | 0.52 | 0.18 | 0.32 |
