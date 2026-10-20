# Drift power from the pilot (sims 2000, seed 20261018)

Pilot file: results/v1.4-study2b-power/pilot-2a-stage-c.json

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
