# Drift power, probe-1 placeholder inputs (sims 2000, seed 20261018)

Placeholders, not the power claim: the claim is re-based on the pilot (drift record §4).

## Fitted D at k = 5

| Style | k | Extrapolation | Y at step k, per run | Mean | Variance | θ (MoM) |
|---|---|---|---|---|---|---|
| Layered drift, probe 1 (Opus by hand; placeholder for the pilot) | 5 | locf | 1, 2, 5 | 2.67 | 4.33 | 4.27 |
| Layered drift, probe 1 (Opus by hand; placeholder for the pilot) | 5 | linear | 1.38, 2, 5 | 2.79 | 3.76 | 8.09 |

## Power (s2d-01 §3 table)

| Input | Mean D | θ | Model | Tasks × reps × generators (blocks) | Step turns | RR | H1 | H2 | Both |
|---|---|---|---|---|---|---|---|---|---|
| probe 1, k = 5 | 2.67 | 4.27 | independent | 4 × 3 × 2 (24) | 312 | 0.25 | 0.99 | 0.99 | 0.98 |
| probe 1, k = 5 | 2.67 | 4.27 | independent | 4 × 3 × 2 (24) | 312 | 0.5 | 0.64 | 0.65 | 0.55 |
| probe 1, k = 5 | 2.67 | 4.27 | independent | 4 × 3 × 2 (24) | 312 | 0.75 | 0.13 | 0.14 | 0.06 |
| probe 1, k = 5 | 2.67 | 4.27 | shared | 4 × 3 × 2 (24) | 312 | 0.25 | 1.00 | 1.00 | 1.00 |
| probe 1, k = 5 | 2.67 | 4.27 | shared | 4 × 3 × 2 (24) | 312 | 0.5 | 0.82 | 0.81 | 0.76 |
| probe 1, k = 5 | 2.67 | 4.27 | shared | 4 × 3 × 2 (24) | 312 | 0.75 | 0.21 | 0.20 | 0.11 |
| probe 1, k = 5 | 2.67 | 4.27 | independent | 4 × 4 × 2 (32) | 416 | 0.25 | 1.00 | 1.00 | 1.00 |
| probe 1, k = 5 | 2.67 | 4.27 | independent | 4 × 4 × 2 (32) | 416 | 0.5 | 0.80 | 0.82 | 0.74 |
| probe 1, k = 5 | 2.67 | 4.27 | independent | 4 × 4 × 2 (32) | 416 | 0.75 | 0.18 | 0.18 | 0.10 |
| probe 1, k = 5 | 2.67 | 4.27 | shared | 4 × 4 × 2 (32) | 416 | 0.25 | 1.00 | 1.00 | 1.00 |
| probe 1, k = 5 | 2.67 | 4.27 | shared | 4 × 4 × 2 (32) | 416 | 0.5 | 0.93 | 0.94 | 0.90 |
| probe 1, k = 5 | 2.67 | 4.27 | shared | 4 × 4 × 2 (32) | 416 | 0.75 | 0.30 | 0.29 | 0.19 |

## Collapse, 32 blocks, independent, RR 0.25 (θ = 4.27)

| Input | Mean D | θ | Model | Tasks × reps × generators (blocks) | Step turns | RR | H1 | H2 | Both |
|---|---|---|---|---|---|---|---|---|---|
| collapse | 2.67 | 4.27 | independent | 4 × 4 × 2 (32) | 416 | 0.25 | 1.00 | 1.00 | 1.00 |
| collapse | 1.50 | 4.27 | independent | 4 × 4 × 2 (32) | 416 | 0.25 | 0.98 | 0.98 | 0.97 |
| collapse | 1 | 4.27 | independent | 4 × 4 × 2 (32) | 416 | 0.25 | 0.90 | 0.91 | 0.87 |
| collapse | 0.75 | 4.27 | independent | 4 × 4 × 2 (32) | 416 | 0.25 | 0.80 | 0.82 | 0.75 |
| collapse | 0.50 | 4.27 | independent | 4 × 4 × 2 (32) | 416 | 0.25 | 0.59 | 0.58 | 0.49 |
