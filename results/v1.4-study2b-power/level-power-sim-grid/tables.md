# Study 2b §3 step 2 on the extended grid (pilotPower, sims 2000, seed 20261018)

Pilot file: results/v1.4-study2b-power/pilot-2a-stage-c.json. Grid: 4 tasks × r replicates × 1 generator, N = 8, 12, 16, 20, 24, 32, 40. θ band 1, 4, ∞; lower bound level 0.8.

## Summary at RR 0.25 (θ 1 / 4 / ∞)

| N (blocks) | r | H1 independent | H2 independent | H1 shared | H2 shared | Keep (independent, every θ ≥ 0.80) |
|---|---|---|---|---|---|---|
| 8 | 2 | 0.02 / 0.06 / 0.08 | 0.03 / 0.06 / 0.08 | 0.03 / 0.06 / 0.08 | 0.02 / 0.06 / 0.08 | no (H1 demote, H2 demote) |
| 12 | 3 | 0.18 / 0.34 / 0.38 | 0.17 / 0.33 / 0.39 | 0.22 / 0.35 / 0.41 | 0.21 / 0.35 / 0.41 | no (H1 demote, H2 demote) |
| 16 | 4 | 0.34 / 0.53 / 0.61 | 0.34 / 0.52 / 0.60 | 0.48 / 0.58 / 0.63 | 0.48 / 0.58 / 0.63 | no (H1 demote, H2 demote) |
| 20 | 5 | 0.51 / 0.68 / 0.78 | 0.49 / 0.69 / 0.78 | 0.67 / 0.76 / 0.78 | 0.66 / 0.77 / 0.78 | no (H1 demote, H2 demote) |
| 24 | 6 | 0.62 / 0.83 / 0.89 | 0.64 / 0.82 / 0.88 | 0.80 / 0.87 / 0.89 | 0.80 / 0.88 / 0.89 | no (H1 demote, H2 demote) |
| 32 | 8 | 0.78 / 0.93 / 0.97 | 0.79 / 0.93 / 0.97 | 0.94 / 0.96 / 0.97 | 0.93 / 0.97 / 0.97 | no (H1 demote, H2 demote) |
| 40 | 10 | 0.91 / 0.98 / 0.99 | 0.90 / 0.98 / 0.99 | 0.98 / 0.99 / 0.99 | 0.98 / 0.99 / 0.99 | yes |

The binding model is "independent" (the drift record §4 rule: power ≥ 0.8 at RR 0.25 for every θ of the band). "shared" is reported beside it, as the drift record §4 requires.

## N = 8

Lower bound: one-sided 0.8 t bound of each generator's pilot mean D, floored at 0.

| Generator | n | Mean D | SD | t quantile | Lower bound |
|---|---|---|---|---|---|
| claude-sonnet-5-5 | 6 |1.50 | 1.05 | 0.9195 | 1.11 |

| Input | Mean D | θ | Model | Tasks × reps × generators (blocks) | Step turns | RR | H1 | H2 | Both |
|---|---|---|---|---|---|---|---|---|---|
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | independent | 4 × 2 × 1 (8) | 104 | 0.25 | 0.02 | 0.03 | 0.02 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | independent | 4 × 2 × 1 (8) | 104 | 0.5 | 0.01 | 0.01 | 0.01 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | independent | 4 × 2 × 1 (8) | 104 | 0.75 | 0.01 | 0.01 | 0.00 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | shared | 4 × 2 × 1 (8) | 104 | 0.25 | 0.03 | 0.02 | 0.02 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | shared | 4 × 2 × 1 (8) | 104 | 0.5 | 0.01 | 0.01 | 0.00 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | shared | 4 × 2 × 1 (8) | 104 | 0.75 | 0.00 | 0.00 | 0.00 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | independent | 4 × 2 × 1 (8) | 104 | 0.25 | 0.06 | 0.06 | 0.05 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | independent | 4 × 2 × 1 (8) | 104 | 0.5 | 0.02 | 0.02 | 0.01 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | independent | 4 × 2 × 1 (8) | 104 | 0.75 | 0.01 | 0.00 | 0.00 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | shared | 4 × 2 × 1 (8) | 104 | 0.25 | 0.06 | 0.06 | 0.05 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | shared | 4 × 2 × 1 (8) | 104 | 0.5 | 0.02 | 0.02 | 0.01 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | shared | 4 × 2 × 1 (8) | 104 | 0.75 | 0.01 | 0.01 | 0.00 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | independent | 4 × 2 × 1 (8) | 104 | 0.25 | 0.08 | 0.08 | 0.07 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | independent | 4 × 2 × 1 (8) | 104 | 0.5 | 0.02 | 0.02 | 0.01 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | independent | 4 × 2 × 1 (8) | 104 | 0.75 | 0.01 | 0.01 | 0.00 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | shared | 4 × 2 × 1 (8) | 104 | 0.25 | 0.08 | 0.08 | 0.06 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | shared | 4 × 2 × 1 (8) | 104 | 0.5 | 0.03 | 0.03 | 0.02 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | shared | 4 × 2 × 1 (8) | 104 | 0.75 | 0.01 | 0.01 | 0.00 |

Power rule (RR 0.25, independent cells, every θ of the band ≥ 0.8):

- H1 none@L2 vs none@L3 (SO5, one sentence per rule): θ 1.00: 0.02; θ 4.00: 0.06; θ ∞ (Poisson): 0.08 → **demote to secondary**
- H2 none@L2 vs mcp@L2 (delivery plus checking): θ 1.00: 0.03; θ 4.00: 0.06; θ ∞ (Poisson): 0.08 → **demote to secondary**

## N = 12

Lower bound: one-sided 0.8 t bound of each generator's pilot mean D, floored at 0.

| Generator | n | Mean D | SD | t quantile | Lower bound |
|---|---|---|---|---|---|
| claude-sonnet-5-5 | 6 |1.50 | 1.05 | 0.9195 | 1.11 |

| Input | Mean D | θ | Model | Tasks × reps × generators (blocks) | Step turns | RR | H1 | H2 | Both |
|---|---|---|---|---|---|---|---|---|---|
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | independent | 4 × 3 × 1 (12) | 156 | 0.25 | 0.18 | 0.17 | 0.13 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | independent | 4 × 3 × 1 (12) | 156 | 0.5 | 0.07 | 0.05 | 0.03 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | independent | 4 × 3 × 1 (12) | 156 | 0.75 | 0.02 | 0.02 | 0.01 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | shared | 4 × 3 × 1 (12) | 156 | 0.25 | 0.22 | 0.21 | 0.18 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | shared | 4 × 3 × 1 (12) | 156 | 0.5 | 0.06 | 0.07 | 0.03 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | shared | 4 × 3 × 1 (12) | 156 | 0.75 | 0.02 | 0.02 | 0.01 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | independent | 4 × 3 × 1 (12) | 156 | 0.25 | 0.34 | 0.33 | 0.26 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | independent | 4 × 3 × 1 (12) | 156 | 0.5 | 0.10 | 0.10 | 0.06 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | independent | 4 × 3 × 1 (12) | 156 | 0.75 | 0.03 | 0.03 | 0.01 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | shared | 4 × 3 × 1 (12) | 156 | 0.25 | 0.35 | 0.35 | 0.28 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | shared | 4 × 3 × 1 (12) | 156 | 0.5 | 0.09 | 0.09 | 0.05 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | shared | 4 × 3 × 1 (12) | 156 | 0.75 | 0.03 | 0.03 | 0.01 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | independent | 4 × 3 × 1 (12) | 156 | 0.25 | 0.38 | 0.39 | 0.30 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | independent | 4 × 3 × 1 (12) | 156 | 0.5 | 0.11 | 0.13 | 0.07 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | independent | 4 × 3 × 1 (12) | 156 | 0.75 | 0.03 | 0.03 | 0.01 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | shared | 4 × 3 × 1 (12) | 156 | 0.25 | 0.41 | 0.41 | 0.33 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | shared | 4 × 3 × 1 (12) | 156 | 0.5 | 0.10 | 0.11 | 0.05 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | shared | 4 × 3 × 1 (12) | 156 | 0.75 | 0.03 | 0.03 | 0.01 |

Power rule (RR 0.25, independent cells, every θ of the band ≥ 0.8):

- H1 none@L2 vs none@L3 (SO5, one sentence per rule): θ 1.00: 0.18; θ 4.00: 0.34; θ ∞ (Poisson): 0.38 → **demote to secondary**
- H2 none@L2 vs mcp@L2 (delivery plus checking): θ 1.00: 0.17; θ 4.00: 0.33; θ ∞ (Poisson): 0.39 → **demote to secondary**

## N = 16

Lower bound: one-sided 0.8 t bound of each generator's pilot mean D, floored at 0.

| Generator | n | Mean D | SD | t quantile | Lower bound |
|---|---|---|---|---|---|
| claude-sonnet-5-5 | 6 |1.50 | 1.05 | 0.9195 | 1.11 |

| Input | Mean D | θ | Model | Tasks × reps × generators (blocks) | Step turns | RR | H1 | H2 | Both |
|---|---|---|---|---|---|---|---|---|---|
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | independent | 4 × 4 × 1 (16) | 208 | 0.25 | 0.34 | 0.34 | 0.26 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | independent | 4 × 4 × 1 (16) | 208 | 0.5 | 0.11 | 0.10 | 0.05 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | independent | 4 × 4 × 1 (16) | 208 | 0.75 | 0.03 | 0.03 | 0.01 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | shared | 4 × 4 × 1 (16) | 208 | 0.25 | 0.48 | 0.48 | 0.41 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | shared | 4 × 4 × 1 (16) | 208 | 0.5 | 0.15 | 0.15 | 0.09 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | shared | 4 × 4 × 1 (16) | 208 | 0.75 | 0.03 | 0.03 | 0.01 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | independent | 4 × 4 × 1 (16) | 208 | 0.25 | 0.53 | 0.52 | 0.43 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | independent | 4 × 4 × 1 (16) | 208 | 0.5 | 0.17 | 0.17 | 0.11 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | independent | 4 × 4 × 1 (16) | 208 | 0.75 | 0.04 | 0.04 | 0.01 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | shared | 4 × 4 × 1 (16) | 208 | 0.25 | 0.58 | 0.58 | 0.49 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | shared | 4 × 4 × 1 (16) | 208 | 0.5 | 0.17 | 0.18 | 0.11 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | shared | 4 × 4 × 1 (16) | 208 | 0.75 | 0.04 | 0.03 | 0.01 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | independent | 4 × 4 × 1 (16) | 208 | 0.25 | 0.61 | 0.60 | 0.52 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | independent | 4 × 4 × 1 (16) | 208 | 0.5 | 0.21 | 0.19 | 0.12 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | independent | 4 × 4 × 1 (16) | 208 | 0.75 | 0.05 | 0.04 | 0.02 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | shared | 4 × 4 × 1 (16) | 208 | 0.25 | 0.63 | 0.63 | 0.54 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | shared | 4 × 4 × 1 (16) | 208 | 0.5 | 0.20 | 0.19 | 0.12 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | shared | 4 × 4 × 1 (16) | 208 | 0.75 | 0.05 | 0.05 | 0.03 |

Power rule (RR 0.25, independent cells, every θ of the band ≥ 0.8):

- H1 none@L2 vs none@L3 (SO5, one sentence per rule): θ 1.00: 0.34; θ 4.00: 0.53; θ ∞ (Poisson): 0.61 → **demote to secondary**
- H2 none@L2 vs mcp@L2 (delivery plus checking): θ 1.00: 0.34; θ 4.00: 0.52; θ ∞ (Poisson): 0.60 → **demote to secondary**

## N = 20

Lower bound: one-sided 0.8 t bound of each generator's pilot mean D, floored at 0.

| Generator | n | Mean D | SD | t quantile | Lower bound |
|---|---|---|---|---|---|
| claude-sonnet-5-5 | 6 |1.50 | 1.05 | 0.9195 | 1.11 |

| Input | Mean D | θ | Model | Tasks × reps × generators (blocks) | Step turns | RR | H1 | H2 | Both |
|---|---|---|---|---|---|---|---|---|---|
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | independent | 4 × 5 × 1 (20) | 260 | 0.25 | 0.51 | 0.49 | 0.40 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | independent | 4 × 5 × 1 (20) | 260 | 0.5 | 0.16 | 0.15 | 0.09 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | independent | 4 × 5 × 1 (20) | 260 | 0.75 | 0.04 | 0.04 | 0.01 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | shared | 4 × 5 × 1 (20) | 260 | 0.25 | 0.67 | 0.66 | 0.59 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | shared | 4 × 5 × 1 (20) | 260 | 0.5 | 0.25 | 0.25 | 0.17 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | shared | 4 × 5 × 1 (20) | 260 | 0.75 | 0.06 | 0.05 | 0.02 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | independent | 4 × 5 × 1 (20) | 260 | 0.25 | 0.68 | 0.69 | 0.60 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | independent | 4 × 5 × 1 (20) | 260 | 0.5 | 0.25 | 0.25 | 0.16 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | independent | 4 × 5 × 1 (20) | 260 | 0.75 | 0.05 | 0.05 | 0.02 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | shared | 4 × 5 × 1 (20) | 260 | 0.25 | 0.76 | 0.77 | 0.69 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | shared | 4 × 5 × 1 (20) | 260 | 0.5 | 0.29 | 0.29 | 0.20 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | shared | 4 × 5 × 1 (20) | 260 | 0.75 | 0.06 | 0.06 | 0.02 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | independent | 4 × 5 × 1 (20) | 260 | 0.25 | 0.78 | 0.78 | 0.71 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | independent | 4 × 5 × 1 (20) | 260 | 0.5 | 0.30 | 0.29 | 0.19 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | independent | 4 × 5 × 1 (20) | 260 | 0.75 | 0.06 | 0.05 | 0.02 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | shared | 4 × 5 × 1 (20) | 260 | 0.25 | 0.78 | 0.78 | 0.71 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | shared | 4 × 5 × 1 (20) | 260 | 0.5 | 0.28 | 0.29 | 0.18 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | shared | 4 × 5 × 1 (20) | 260 | 0.75 | 0.06 | 0.06 | 0.03 |

Power rule (RR 0.25, independent cells, every θ of the band ≥ 0.8):

- H1 none@L2 vs none@L3 (SO5, one sentence per rule): θ 1.00: 0.51; θ 4.00: 0.68; θ ∞ (Poisson): 0.78 → **demote to secondary**
- H2 none@L2 vs mcp@L2 (delivery plus checking): θ 1.00: 0.49; θ 4.00: 0.69; θ ∞ (Poisson): 0.78 → **demote to secondary**

## N = 24

Lower bound: one-sided 0.8 t bound of each generator's pilot mean D, floored at 0.

| Generator | n | Mean D | SD | t quantile | Lower bound |
|---|---|---|---|---|---|
| claude-sonnet-5-5 | 6 |1.50 | 1.05 | 0.9195 | 1.11 |

| Input | Mean D | θ | Model | Tasks × reps × generators (blocks) | Step turns | RR | H1 | H2 | Both |
|---|---|---|---|---|---|---|---|---|---|
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | independent | 4 × 6 × 1 (24) | 312 | 0.25 | 0.62 | 0.64 | 0.54 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | independent | 4 × 6 × 1 (24) | 312 | 0.5 | 0.17 | 0.18 | 0.11 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | independent | 4 × 6 × 1 (24) | 312 | 0.75 | 0.05 | 0.04 | 0.02 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | shared | 4 × 6 × 1 (24) | 312 | 0.25 | 0.80 | 0.80 | 0.74 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | shared | 4 × 6 × 1 (24) | 312 | 0.5 | 0.33 | 0.33 | 0.24 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | shared | 4 × 6 × 1 (24) | 312 | 0.75 | 0.07 | 0.06 | 0.03 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | independent | 4 × 6 × 1 (24) | 312 | 0.25 | 0.83 | 0.82 | 0.76 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | independent | 4 × 6 × 1 (24) | 312 | 0.5 | 0.31 | 0.33 | 0.22 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | independent | 4 × 6 × 1 (24) | 312 | 0.75 | 0.07 | 0.06 | 0.03 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | shared | 4 × 6 × 1 (24) | 312 | 0.25 | 0.87 | 0.88 | 0.83 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | shared | 4 × 6 × 1 (24) | 312 | 0.5 | 0.37 | 0.38 | 0.28 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | shared | 4 × 6 × 1 (24) | 312 | 0.75 | 0.08 | 0.07 | 0.03 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | independent | 4 × 6 × 1 (24) | 312 | 0.25 | 0.89 | 0.88 | 0.84 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | independent | 4 × 6 × 1 (24) | 312 | 0.5 | 0.38 | 0.38 | 0.27 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | independent | 4 × 6 × 1 (24) | 312 | 0.75 | 0.07 | 0.07 | 0.03 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | shared | 4 × 6 × 1 (24) | 312 | 0.25 | 0.89 | 0.89 | 0.84 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | shared | 4 × 6 × 1 (24) | 312 | 0.5 | 0.37 | 0.37 | 0.27 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | shared | 4 × 6 × 1 (24) | 312 | 0.75 | 0.09 | 0.08 | 0.04 |

Power rule (RR 0.25, independent cells, every θ of the band ≥ 0.8):

- H1 none@L2 vs none@L3 (SO5, one sentence per rule): θ 1.00: 0.62; θ 4.00: 0.83; θ ∞ (Poisson): 0.89 → **demote to secondary**
- H2 none@L2 vs mcp@L2 (delivery plus checking): θ 1.00: 0.64; θ 4.00: 0.82; θ ∞ (Poisson): 0.88 → **demote to secondary**

## N = 32

Lower bound: one-sided 0.8 t bound of each generator's pilot mean D, floored at 0.

| Generator | n | Mean D | SD | t quantile | Lower bound |
|---|---|---|---|---|---|
| claude-sonnet-5-5 | 6 |1.50 | 1.05 | 0.9195 | 1.11 |

| Input | Mean D | θ | Model | Tasks × reps × generators (blocks) | Step turns | RR | H1 | H2 | Both |
|---|---|---|---|---|---|---|---|---|---|
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | independent | 4 × 8 × 1 (32) | 416 | 0.25 | 0.78 | 0.79 | 0.71 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | independent | 4 × 8 × 1 (32) | 416 | 0.5 | 0.29 | 0.29 | 0.19 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | independent | 4 × 8 × 1 (32) | 416 | 0.75 | 0.06 | 0.06 | 0.02 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | shared | 4 × 8 × 1 (32) | 416 | 0.25 | 0.94 | 0.93 | 0.91 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | shared | 4 × 8 × 1 (32) | 416 | 0.5 | 0.51 | 0.50 | 0.41 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | shared | 4 × 8 × 1 (32) | 416 | 0.75 | 0.10 | 0.10 | 0.05 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | independent | 4 × 8 × 1 (32) | 416 | 0.25 | 0.93 | 0.93 | 0.91 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | independent | 4 × 8 × 1 (32) | 416 | 0.5 | 0.45 | 0.42 | 0.33 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | independent | 4 × 8 × 1 (32) | 416 | 0.75 | 0.10 | 0.09 | 0.05 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | shared | 4 × 8 × 1 (32) | 416 | 0.25 | 0.96 | 0.97 | 0.95 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | shared | 4 × 8 × 1 (32) | 416 | 0.5 | 0.53 | 0.53 | 0.42 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | shared | 4 × 8 × 1 (32) | 416 | 0.75 | 0.10 | 0.11 | 0.05 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | independent | 4 × 8 × 1 (32) | 416 | 0.25 | 0.97 | 0.97 | 0.95 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | independent | 4 × 8 × 1 (32) | 416 | 0.5 | 0.54 | 0.54 | 0.42 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | independent | 4 × 8 × 1 (32) | 416 | 0.75 | 0.10 | 0.10 | 0.05 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | shared | 4 × 8 × 1 (32) | 416 | 0.25 | 0.97 | 0.97 | 0.95 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | shared | 4 × 8 × 1 (32) | 416 | 0.5 | 0.55 | 0.55 | 0.44 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | shared | 4 × 8 × 1 (32) | 416 | 0.75 | 0.10 | 0.11 | 0.05 |

Power rule (RR 0.25, independent cells, every θ of the band ≥ 0.8):

- H1 none@L2 vs none@L3 (SO5, one sentence per rule): θ 1.00: 0.78; θ 4.00: 0.93; θ ∞ (Poisson): 0.97 → **demote to secondary**
- H2 none@L2 vs mcp@L2 (delivery plus checking): θ 1.00: 0.79; θ 4.00: 0.93; θ ∞ (Poisson): 0.97 → **demote to secondary**

## N = 40

Lower bound: one-sided 0.8 t bound of each generator's pilot mean D, floored at 0.

| Generator | n | Mean D | SD | t quantile | Lower bound |
|---|---|---|---|---|---|
| claude-sonnet-5-5 | 6 |1.50 | 1.05 | 0.9195 | 1.11 |

| Input | Mean D | θ | Model | Tasks × reps × generators (blocks) | Step turns | RR | H1 | H2 | Both |
|---|---|---|---|---|---|---|---|---|---|
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | independent | 4 × 10 × 1 (40) | 520 | 0.25 | 0.91 | 0.90 | 0.86 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | independent | 4 × 10 × 1 (40) | 520 | 0.5 | 0.40 | 0.40 | 0.29 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | independent | 4 × 10 × 1 (40) | 520 | 0.75 | 0.07 | 0.07 | 0.03 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | shared | 4 × 10 × 1 (40) | 520 | 0.25 | 0.98 | 0.98 | 0.97 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | shared | 4 × 10 × 1 (40) | 520 | 0.5 | 0.62 | 0.63 | 0.52 |
| pilot lower bound, θ 1.00 | 1.11 | 1.00 | shared | 4 × 10 × 1 (40) | 520 | 0.75 | 0.13 | 0.14 | 0.07 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | independent | 4 × 10 × 1 (40) | 520 | 0.25 | 0.98 | 0.98 | 0.97 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | independent | 4 × 10 × 1 (40) | 520 | 0.5 | 0.57 | 0.57 | 0.46 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | independent | 4 × 10 × 1 (40) | 520 | 0.75 | 0.12 | 0.12 | 0.07 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | shared | 4 × 10 × 1 (40) | 520 | 0.25 | 0.99 | 0.99 | 0.98 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | shared | 4 × 10 × 1 (40) | 520 | 0.5 | 0.66 | 0.66 | 0.57 |
| pilot lower bound, θ 4.00 | 1.11 | 4.00 | shared | 4 × 10 × 1 (40) | 520 | 0.75 | 0.16 | 0.15 | 0.08 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | independent | 4 × 10 × 1 (40) | 520 | 0.25 | 0.99 | 0.99 | 0.99 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | independent | 4 × 10 × 1 (40) | 520 | 0.5 | 0.68 | 0.67 | 0.58 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | independent | 4 × 10 × 1 (40) | 520 | 0.75 | 0.15 | 0.15 | 0.08 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | shared | 4 × 10 × 1 (40) | 520 | 0.25 | 0.99 | 0.99 | 0.99 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | shared | 4 × 10 × 1 (40) | 520 | 0.5 | 0.66 | 0.68 | 0.57 |
| pilot lower bound, θ ∞ (Poisson) | 1.11 | ∞ (Poisson) | shared | 4 × 10 × 1 (40) | 520 | 0.75 | 0.14 | 0.14 | 0.07 |

Power rule (RR 0.25, independent cells, every θ of the band ≥ 0.8):

- H1 none@L2 vs none@L3 (SO5, one sentence per rule): θ 1.00: 0.91; θ 4.00: 0.98; θ ∞ (Poisson): 0.99 → **keep as confirmatory**
- H2 none@L2 vs mcp@L2 (delivery plus checking): θ 1.00: 0.90; θ 4.00: 0.98; θ ∞ (Poisson): 0.99 → **keep as confirmatory**
