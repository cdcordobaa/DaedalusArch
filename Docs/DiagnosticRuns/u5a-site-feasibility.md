# U5a site-feasibility table (BR-U5a-36 c, BR-U5a-37)

Measured 2026-10-08T22:23:47.089Z. findSites + preconditions per operator per prepared base; no RNG, no detector, no edit.

Held-out golden totals: k = 2 → 47, k = 3 → 69. Rule: no k: CAT_SHORTFALL: held-out golden total at k = 3 is 69 < 80; no k chosen (author decision, BR-U5a-37).

## Golden-instance operators (counted)

| Project | Split | Operator | Candidates | Rejected by reason | Eligible | k=2 | k=3 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| realworld-test | held-out | MO-S01 | 0 | — | 0 | 0 | 0 |
| realworld-test | held-out | MO-P01 | 20 | already-imported 5 | 15 | 2 | 3 |
| realworld-test | held-out | MO-C04 | 2 | — | 2 | 2 | 2 |
| realworld-test | held-out | MO-SO01 | 25 | metric-already-violating 2 | 23 | 2 | 3 |
| realworld-test | held-out | MO-CV02 | 4 | — | 4 | 2 | 3 |
| realworld-test | held-out | MO-DF01 | 0 | — | 0 | 0 | 0 |
| realworld-test | held-out | MO-X01 | 0 | — | 0 | 0 | 0 |
| realworld-test | held-out | MO-SO02 | 0 | — | 0 | 0 | 0 |
| realworld-test | held-out | MO-S03 | 0 | — | 0 | 0 | 0 |
| ghostfolio-test | held-out | MO-S01 | 0 | — | 0 | 0 | 0 |
| ghostfolio-test | held-out | MO-P01 | 80 | — | 80 | 2 | 3 |
| ghostfolio-test | held-out | MO-C04 | 53 | — | 53 | 2 | 3 |
| ghostfolio-test | held-out | MO-SO01 | 187 | metric-already-violating 15 | 172 | 2 | 3 |
| ghostfolio-test | held-out | MO-CV02 | 62 | — | 62 | 2 | 3 |
| ghostfolio-test | held-out | MO-DF01 | 0 | — | 0 | 0 | 0 |
| ghostfolio-test | held-out | MO-X01 | 0 | — | 0 | 0 | 0 |
| ghostfolio-test | held-out | MO-SO02 | 27 | implementer-over-threshold 2, metric-already-violating 1 | 24 | 2 | 3 |
| ghostfolio-test | held-out | MO-S03 | 0 | — | 0 | 0 | 0 |
| truthy-demo | held-out | MO-S01 | 77 | — | 77 | 2 | 3 |
| truthy-demo | held-out | MO-P01 | 28 | already-imported 6 | 22 | 2 | 3 |
| truthy-demo | held-out | MO-C04 | 9 | — | 9 | 2 | 3 |
| truthy-demo | held-out | MO-SO01 | 72 | metric-already-violating 2 | 70 | 2 | 3 |
| truthy-demo | held-out | MO-CV02 | 8 | — | 8 | 2 | 3 |
| truthy-demo | held-out | MO-DF01 | 77 | type-shape 28 | 49 | 2 | 3 |
| truthy-demo | held-out | MO-X01 | 77 | — | 77 | 2 | 3 |
| truthy-demo | held-out | MO-SO02 | 1 | — | 1 | 1 | 1 |
| truthy-demo | held-out | MO-S03 | 220 | style-disabled 220 | 0 | 0 | 0 |
| dry-run-test | held-out | MO-S01 | 120 | — | 120 | 2 | 3 |
| dry-run-test | held-out | MO-P01 | 40 | already-imported 5 | 35 | 2 | 3 |
| dry-run-test | held-out | MO-C04 | 19 | — | 19 | 2 | 3 |
| dry-run-test | held-out | MO-SO01 | 103 | metric-already-violating 2 | 101 | 2 | 3 |
| dry-run-test | held-out | MO-CV02 | 19 | — | 19 | 2 | 3 |
| dry-run-test | held-out | MO-DF01 | 120 | type-shape 110 | 10 | 2 | 3 |
| dry-run-test | held-out | MO-X01 | 120 | — | 120 | 2 | 3 |
| dry-run-test | held-out | MO-SO02 | 0 | — | 0 | 0 | 0 |
| dry-run-test | held-out | MO-S03 | 444 | style-disabled 444 | 0 | 0 | 0 |

## Twins and judge probes (sampled with the same k, not counted)

| Project | Split | Operator | Candidates | Rejected by reason | Eligible | k=2 | k=3 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| realworld-test | held-out | MO-S01n | 0 | — | 0 | 0 | 0 |
| realworld-test | held-out | MO-P01n | 0 | — | 0 | 0 | 0 |
| realworld-test | held-out | MO-C04n | 22 | — | 22 | 2 | 3 |
| realworld-test | held-out | MO-SO01n | 25 | metric-already-violating 2 | 23 | 2 | 3 |
| realworld-test | held-out | MO-CV02n | 4 | — | 4 | 2 | 3 |
| realworld-test | held-out | MO-DF01n | 0 | — | 0 | 0 | 0 |
| realworld-test | held-out | MO-X01n | 0 | — | 0 | 0 | 0 |
| realworld-test | held-out | MO-X02 | 0 | — | 0 | 0 | 0 |
| realworld-test | held-out | MO-X02n | 19 | judge-unit-not-selected 4 | 15 | 2 | 3 |
| realworld-test | held-out | MO-SO02n | 0 | — | 0 | 0 | 0 |
| realworld-test | held-out | MO-X03 | 0 | — | 0 | 0 | 0 |
| realworld-test | held-out | MO-X03n | 0 | — | 0 | 0 | 0 |
| realworld-test | held-out | MO-S03n | 11 | style-disabled 11 | 0 | 0 | 0 |
| ghostfolio-test | held-out | MO-S01n | 0 | — | 0 | 0 | 0 |
| ghostfolio-test | held-out | MO-P01n | 0 | — | 0 | 0 | 0 |
| ghostfolio-test | held-out | MO-C04n | 4630 | — | 4630 | 2 | 3 |
| ghostfolio-test | held-out | MO-SO01n | 187 | metric-already-violating 15, threshold-arithmetic 6 | 166 | 2 | 3 |
| ghostfolio-test | held-out | MO-CV02n | 62 | — | 62 | 2 | 3 |
| ghostfolio-test | held-out | MO-DF01n | 0 | — | 0 | 0 | 0 |
| ghostfolio-test | held-out | MO-X01n | 0 | — | 0 | 0 | 0 |
| ghostfolio-test | held-out | MO-X02 | 0 | — | 0 | 0 | 0 |
| ghostfolio-test | held-out | MO-X02n | 22 | judge-unit-not-selected 11 | 11 | 2 | 3 |
| ghostfolio-test | held-out | MO-SO02n | 27 | implementer-over-threshold 1, metric-already-violating 1 | 25 | 2 | 3 |
| ghostfolio-test | held-out | MO-X03 | 0 | — | 0 | 0 | 0 |
| ghostfolio-test | held-out | MO-X03n | 0 | — | 0 | 0 | 0 |
| ghostfolio-test | held-out | MO-S03n | 1540 | style-disabled 1540 | 0 | 0 | 0 |
| truthy-demo | held-out | MO-S01n | 22 | edge-exists 1 | 21 | 2 | 3 |
| truthy-demo | held-out | MO-P01n | 44 | already-imported 9 | 35 | 2 | 3 |
| truthy-demo | held-out | MO-C04n | 260 | — | 260 | 2 | 3 |
| truthy-demo | held-out | MO-SO01n | 72 | metric-already-violating 2, threshold-arithmetic 1 | 69 | 2 | 3 |
| truthy-demo | held-out | MO-CV02n | 8 | — | 8 | 2 | 3 |
| truthy-demo | held-out | MO-DF01n | 70 | edge-exists 3, type-shape 30 | 37 | 2 | 3 |
| truthy-demo | held-out | MO-X01n | 22 | threshold-arithmetic 2, edge-exists 1 | 19 | 2 | 3 |
| truthy-demo | held-out | MO-X02 | 0 | — | 0 | 0 | 0 |
| truthy-demo | held-out | MO-X02n | 33 | judge-unit-not-selected 28 | 5 | 2 | 3 |
| truthy-demo | held-out | MO-SO02n | 1 | — | 1 | 1 | 1 |
| truthy-demo | held-out | MO-X03 | 0 | — | 0 | 0 | 0 |
| truthy-demo | held-out | MO-X03n | 0 | — | 0 | 0 | 0 |
| truthy-demo | held-out | MO-S03n | 40 | style-disabled 40 | 0 | 0 | 0 |
| dry-run-test | held-out | MO-S01n | 70 | edge-exists 15 | 55 | 2 | 3 |
| dry-run-test | held-out | MO-P01n | 56 | already-imported 3 | 53 | 2 | 3 |
| dry-run-test | held-out | MO-C04n | 582 | — | 582 | 2 | 3 |
| dry-run-test | held-out | MO-SO01n | 103 | metric-already-violating 2 | 101 | 2 | 3 |
| dry-run-test | held-out | MO-CV02n | 19 | — | 19 | 2 | 3 |
| dry-run-test | held-out | MO-DF01n | 120 | edge-exists 15 | 105 | 2 | 3 |
| dry-run-test | held-out | MO-X01n | 60 | edge-exists 12 | 48 | 2 | 3 |
| dry-run-test | held-out | MO-X02 | 0 | — | 0 | 0 | 0 |
| dry-run-test | held-out | MO-X02n | 19 | judge-unit-not-selected 19 | 0 | 0 | 0 |
| dry-run-test | held-out | MO-SO02n | 0 | — | 0 | 0 | 0 |
| dry-run-test | held-out | MO-X03 | 0 | — | 0 | 0 | 0 |
| dry-run-test | held-out | MO-X03n | 0 | — | 0 | 0 | 0 |
| dry-run-test | held-out | MO-S03n | 185 | style-disabled 185 | 0 | 0 | 0 |
