# Study 2b resampling power (sims 2000, seed 20261021, α′ = 0.0167)

Source: `results/v1.4-exploratory/stage-c/rescore/runs.json` (registered D, freeze, `correct` only). Blocks: hive-health/rep1, hive-health/rep2, ice-rink/rep1, ice-rink/rep2, youth-league/rep1, youth-league/rep2.

| Cell | D per block | mean D | SD D | NB θ (moments) | P(D = 0) |
|---|---|---|---|---|---|
| none@L2 | 1, 0, 1, 3, 2, 2 | 1.50 | 1.05 | undefined | 0.17 |
| none@L3 | 2, 0, 0, 2, 0, 0 | 0.67 | 1.03 | 1.11 | 0.67 |
| mcp@L2 | 1, 0, 0, 0, 0, 2 | 0.50 | 0.84 | 1.25 | 0.67 |

Y₁: 1, 1, 4, 4, 1, 1 (mean 2.00). Exactness floor at α′: 7 non-zero pairs (Holm 2nd 7, 3rd 6).

| Contrast | d_b | p₀ | q | mean d | SD d | blocks needed (step 1) |
|---|---|---|---|---|---|---|
| H1: none@L2 − none@L3 | -1, 0, 1, 1, 2, 2 | 0.17 | 0.80 | 0.83 | 1.17 | 8.4 |
| H2: none@L2 − mcp@L2 | 0, 0, 1, 3, 2, 0 | 0.50 | 1.00 | 1.00 | 1.26 | 14.0 |
| H3: none@L3 − mcp@L2 | 1, 0, 0, 2, 0, -2 | 0.50 | 0.67 | 0.17 | 1.33 | 14.0 |

| Contrast | Size | N = 8 | N = 12 | N = 16 | N = 20 | N = 24 | smallest N ≥ 0.80 |
|---|---|---|---|---|---|---|---|
| H1 | 2a size | 0.122 | 0.305 | 0.519 | 0.688 | 0.810 | 24 |
| H1 | half size | 0.026 | 0.197 | 0.309 | 0.446 | 0.569 | none |
| H2 | 2a size | 0.040 | 0.393 | 0.790 | 0.953 | 0.989 | 20 |
| H2 | half size | 0.015 | 0.209 | 0.554 | 0.805 | 0.943 | 20 |
| H3 | 2a size | 0.001 | 0.021 | 0.030 | 0.030 | 0.031 | none |
| H3 | half size | 0.000 | 0.003 | 0.013 | 0.015 | 0.017 | none |

H1, H2: rejections with the predicted sign (T > 0). H3: any rejection (not powered).

Choice: kept H2; demoted H1; N = 20, r = 5, turns = 260, turn cap = 390.
