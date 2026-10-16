# DEVELOPMENT-SET STAND-IN: holdout-run.ts on the development reference set (not a hold-out result, not a validity figure)

Tool commit 31bd06f3baf19aaf3d860632a280909bebff52ff. Hold-out tree sha256 d28fbdf8003cf515218eb98d412e1a8715d8f54d2d7b1de4a351713ebfb79aa9. Run directory results/v1.3-reference/holdout-runner-standin/run-1.

## Claim levels (prespec §5)

| Style | Metric | Value x/n [95% Wilson] | Target | Point estimate | Lower bound | n for a perfect pass | Claim |
|---|---|---|---|---|---|---|---|
| clean-architecture | M1 blocking recall | 1.000 (13/13) [0.772, 1.000] | 0.9 | pass | FAIL (unreachable at this n) | 35 | validated at point estimate |
| clean-architecture | M2 blocking precision (manifest) | 1.000 (13/13) [0.772, 1.000] | 0.9 | pass | FAIL (unreachable at this n) | 35 | validated at point estimate |
| clean-architecture | M3 blocking precision (correct) | 1.000 (12/12) [0.758, 1.000] | 0.9 | pass | FAIL (unreachable at this n) | 35 | validated at point estimate |
| clean-architecture | M7 import-edge recall (adjudicated) | 1.000 (69/69) [0.947, 1.000] | 0.95 | pass | FAIL (unreachable at this n) | 73 | validated at point estimate |
| clean-architecture | M7 import-edge precision (adjudicated) | 1.000 (69/69) [0.947, 1.000] | 0.95 | pass | FAIL (unreachable at this n) | 73 | validated at point estimate |
| clean-architecture | M7 file-to-layer accuracy (adjudicated) | 1.000 (29/29) [0.883, 1.000] | 0.95 | pass | FAIL (unreachable at this n) | 73 | validated at point estimate |
| **clean-architecture** | **overall (weakest)** | | | | | | **validated at point estimate** |
| layered | M1 blocking recall | 1.000 (11/11) [0.741, 1.000] | 0.9 | pass | FAIL (unreachable at this n) | 35 | validated at point estimate |
| layered | M2 blocking precision (manifest) | 1.000 (11/11) [0.741, 1.000] | 0.9 | pass | FAIL (unreachable at this n) | 35 | validated at point estimate |
| layered | M3 blocking precision (correct) | 1.000 (11/11) [0.741, 1.000] | 0.9 | pass | FAIL (unreachable at this n) | 35 | validated at point estimate |
| layered | M7 import-edge recall (adjudicated) | 1.000 (62/62) [0.942, 1.000] | 0.95 | pass | FAIL (unreachable at this n) | 73 | validated at point estimate |
| layered | M7 import-edge precision (adjudicated) | 1.000 (62/62) [0.942, 1.000] | 0.95 | pass | FAIL (unreachable at this n) | 73 | validated at point estimate |
| layered | M7 file-to-layer accuracy (adjudicated) | 1.000 (27/27) [0.875, 1.000] | 0.95 | pass | FAIL (unreachable at this n) | 73 | validated at point estimate |
| **layered** | **overall (weakest)** | | | | | | **validated at point estimate** |
| nestjs | M1 blocking recall | 1.000 (11/11) [0.741, 1.000] | 0.9 | pass | FAIL (unreachable at this n) | 35 | validated at point estimate |
| nestjs | M2 blocking precision (manifest) | 1.000 (11/11) [0.741, 1.000] | 0.9 | pass | FAIL (unreachable at this n) | 35 | validated at point estimate |
| nestjs | M3 blocking precision (correct) | 1.000 (10/10) [0.722, 1.000] | 0.9 | pass | FAIL (unreachable at this n) | 35 | validated at point estimate |
| nestjs | M7 import-edge recall (adjudicated) | 1.000 (64/64) [0.943, 1.000] | 0.95 | pass | FAIL (unreachable at this n) | 73 | validated at point estimate |
| nestjs | M7 import-edge precision (adjudicated) | 1.000 (64/64) [0.943, 1.000] | 0.95 | pass | FAIL (unreachable at this n) | 73 | validated at point estimate |
| nestjs | M7 file-to-layer accuracy (adjudicated) | 1.000 (29/29) [0.883, 1.000] | 0.95 | pass | FAIL (unreachable at this n) | 73 | validated at point estimate |
| **nestjs** | **overall (weakest)** | | | | | | **validated at point estimate** |
| hexagonal | M1 blocking recall | 1.000 (13/13) [0.772, 1.000] | 0.9 | pass | FAIL (unreachable at this n) | 35 | validated at point estimate |
| hexagonal | M2 blocking precision (manifest) | 1.000 (13/13) [0.772, 1.000] | 0.9 | pass | FAIL (unreachable at this n) | 35 | validated at point estimate |
| hexagonal | M3 blocking precision (correct) | 1.000 (12/12) [0.758, 1.000] | 0.9 | pass | FAIL (unreachable at this n) | 35 | validated at point estimate |
| hexagonal | M7 import-edge recall (adjudicated) | 1.000 (74/74) [0.951, 1.000] | 0.95 | pass | pass | 73 | validated |
| hexagonal | M7 import-edge precision (adjudicated) | 1.000 (74/74) [0.951, 1.000] | 0.95 | pass | pass | 73 | validated |
| hexagonal | M7 file-to-layer accuracy (adjudicated) | 1.000 (30/30) [0.886, 1.000] | 0.95 | pass | FAIL (unreachable at this n) | 73 | validated at point estimate |
| **hexagonal** | **overall (weakest)** | | | | | | **validated at point estimate** |
| ddd | M1 blocking recall | 1.000 (8/8) [0.676, 1.000] | 0.9 | pass | FAIL (unreachable at this n) | 35 | validated at point estimate |
| ddd | M2 blocking precision (manifest) | 1.000 (8/8) [0.676, 1.000] | 0.9 | pass | FAIL (unreachable at this n) | 35 | validated at point estimate |
| ddd | M3 blocking precision (correct) | 1.000 (8/8) [0.676, 1.000] | 0.9 | pass | FAIL (unreachable at this n) | 35 | validated at point estimate |
| ddd | M7 import-edge recall (adjudicated) | 1.000 (16/16) [0.806, 1.000] | 0.95 | pass | FAIL (unreachable at this n) | 73 | validated at point estimate |
| ddd | M7 file-to-layer accuracy (adjudicated) | 1.000 (31/31) [0.890, 1.000] | 0.95 | pass | FAIL (unreachable at this n) | 73 | validated at point estimate |
| **ddd** | **overall (weakest)** | | | | | | **validated at point estimate** |
| pooled | M2 blocking precision (manifest) | 1.000 (56/56) [0.936, 1.000] | 0.9 | pass | pass | 35 | validated |
| pooled | M3 blocking precision (correct) | 1.000 (53/53) [0.932, 1.000] | 0.9 | pass | pass | 35 | validated |

A perfect result's 95% Wilson lower bound reaches 0.9 only at n >= 35 and 0.95 only at n >= 73; below that, the lower-bound check cannot pass even with no error (prespec §5).

Deferred rules, kept out of M1 and M2 and reported apart: FF-DS01.

## M1, M2 (compare.ts matching, primary) and the normalisation views

| Style | Variants (v/n/c) | M1 blocking recall | M2 blocking precision | Precision distinct (normalisation) | Strict-key recall | Strict-key precision | Planted detected | Deferred TP/FN/FP |
|---|---|---|---|---|---|---|---|---|
| clean-architecture | 10/3/1 | 1.000 (13/13) [0.772, 1.000] | 1.000 (13/13) [0.772, 1.000] | 1.000 (13/13) [0.772, 1.000] | 0.923 (12/13) [0.667, 0.986] | 0.923 (12/13) [0.667, 0.986] | 0.900 (9/10) [0.596, 0.982] | 0/0/0 |
| layered | 9/3/1 | 1.000 (11/11) [0.741, 1.000] | 1.000 (11/11) [0.741, 1.000] | 1.000 (11/11) [0.741, 1.000] | 0.818 (9/11) [0.523, 0.949] | 0.818 (9/11) [0.523, 0.949] | 1.000 (9/9) [0.701, 1.000] | 0/0/0 |
| nestjs | 10/3/1 | 1.000 (11/11) [0.741, 1.000] | 1.000 (11/11) [0.741, 1.000] | 1.000 (11/11) [0.741, 1.000] | 0.909 (10/11) [0.623, 0.984] | 0.909 (10/11) [0.623, 0.984] | 0.900 (9/10) [0.596, 0.982] | 0/0/0 |
| hexagonal | 11/3/1 | 1.000 (13/13) [0.772, 1.000] | 1.000 (13/13) [0.772, 1.000] | 1.000 (13/13) [0.772, 1.000] | 0.923 (12/13) [0.667, 0.986] | 0.923 (12/13) [0.667, 0.986] | 1.000 (11/11) [0.741, 1.000] | 0/0/0 |
| ddd | 12/2/1 | 1.000 (8/8) [0.676, 1.000] | 1.000 (8/8) [0.676, 1.000] | 1.000 (8/8) [0.676, 1.000] | 1.000 (8/8) [0.676, 1.000] | 1.000 (8/8) [0.676, 1.000] | 1.000 (12/12) [0.758, 1.000] | 1/0/0 |
| **pooled** | | 1.000 (56/56) [0.936, 1.000] | 1.000 (56/56) [0.936, 1.000] | 1.000 (56/56) [0.936, 1.000] | 0.911 (51/56) [0.807, 0.961] | 0.911 (51/56) [0.807, 0.961] | | 1/0/0 |

## M3 blocking precision (correct, check-correct.ts)

| Style | Correct / checkable | Not checkable |
|---|---|---|
| clean-architecture | 1.000 (12/12) [0.758, 1.000] | 1 |
| layered | 1.000 (11/11) [0.741, 1.000] | 0 |
| nestjs | 1.000 (10/10) [0.722, 1.000] | 1 |
| hexagonal | 1.000 (12/12) [0.758, 1.000] | 1 |
| ddd | 1.000 (8/8) [0.676, 1.000] | 0 |
| **pooled** | 1.000 (53/53) [0.932, 1.000] | |

- clean-architecture/v08-domain-service-holds-infrastructure-clock: FF-P06 src/domain/services/LoanPolicy.ts: not checkable: FLOWS_TO (field) half: reported N/A by rule-tiers.md (FF-P06, finding 9)
- nestjs/v10-domain-policy-holds-repository: FF-P06 src/domain/registration-policy.ts: not checkable: FLOWS_TO (field) half: reported N/A by rule-tiers.md (FF-P06, finding 9)
- hexagonal/v10-domain-service-holds-adapter: FF-P06 src/domain/services/AvailabilityChecker.ts: not checkable: FLOWS_TO (field) half: reported N/A by rule-tiers.md (FF-P06, finding 9)

## M4 advisory rules (reported separately; never a pass or fail) and per-rule figures (descriptive)

| Style | Rule | Tier | TP | FN | FP | Recall | Precision |
|---|---|---|---|---|---|---|---|
| clean-architecture | FF-S01 dependency-direction | blocking | 5 | 0 | 0 | 1.000 (5/5) [0.566, 1.000] | 1.000 (5/5) [0.566, 1.000] |
| clean-architecture | FF-S02 no-cyclic-deps | blocking | 1 | 0 | 0 | 1.000 (1/1) [0.207, 1.000] | 1.000 (1/1) [0.207, 1.000] |
| clean-architecture | FF-S04 no-domain-outward-dep | blocking | 3 | 0 | 0 | 1.000 (3/3) [0.439, 1.000] | 1.000 (3/3) [0.439, 1.000] |
| clean-architecture | FF-P01 domain-purity | blocking | 2 | 0 | 0 | 1.000 (2/2) [0.342, 1.000] | 1.000 (2/2) [0.342, 1.000] |
| clean-architecture | FF-P02 dependency-inversion | advisory | 1 | 0 | 0 | 1.000 (1/1) [0.207, 1.000] | 1.000 (1/1) [0.207, 1.000] |
| clean-architecture | FF-P03 repository-pattern | blocking | 1 | 0 | 0 | 1.000 (1/1) [0.207, 1.000] | 1.000 (1/1) [0.207, 1.000] |
| clean-architecture | FF-P04 use-case-isolation | advisory | 1 | 0 | 0 | 1.000 (1/1) [0.207, 1.000] | 1.000 (1/1) [0.207, 1.000] |
| clean-architecture | FF-P05 controller-no-entity | advisory | 0 | 1 | 0 | 0.000 (0/1) [0.000, 0.793] | 0/0 |
| clean-architecture | FF-P06 domain-state-purity | blocking | 1 | 0 | 0 | 1.000 (1/1) [0.207, 1.000] | 1.000 (1/1) [0.207, 1.000] |
| layered | FF-S01 dependency-direction | blocking | 2 | 0 | 0 | 1.000 (2/2) [0.342, 1.000] | 1.000 (2/2) [0.342, 1.000] |
| layered | FF-S02 no-cyclic-deps | blocking | 2 | 0 | 0 | 1.000 (2/2) [0.342, 1.000] | 1.000 (2/2) [0.342, 1.000] |
| layered | FF-S03 no-layer-skip | blocking | 5 | 0 | 0 | 1.000 (5/5) [0.566, 1.000] | 1.000 (5/5) [0.566, 1.000] |
| layered | FF-P01 domain-purity | blocking | 2 | 0 | 0 | 1.000 (2/2) [0.342, 1.000] | 1.000 (2/2) [0.342, 1.000] |
| nestjs | FF-S01 dependency-direction | blocking | 4 | 0 | 0 | 1.000 (4/4) [0.510, 1.000] | 1.000 (4/4) [0.510, 1.000] |
| nestjs | FF-S02 no-cyclic-deps | blocking | 1 | 0 | 0 | 1.000 (1/1) [0.207, 1.000] | 1.000 (1/1) [0.207, 1.000] |
| nestjs | FF-S04 no-domain-outward-dep | blocking | 2 | 0 | 0 | 1.000 (2/2) [0.342, 1.000] | 1.000 (2/2) [0.342, 1.000] |
| nestjs | FF-P01 domain-purity | blocking | 2 | 0 | 0 | 1.000 (2/2) [0.342, 1.000] | 1.000 (2/2) [0.342, 1.000] |
| nestjs | FF-P02 dependency-inversion | advisory | 1 | 0 | 1 | 1.000 (1/1) [0.207, 1.000] | 0.500 (1/2) [0.095, 0.905] |
| nestjs | FF-P03 repository-pattern | blocking | 1 | 0 | 0 | 1.000 (1/1) [0.207, 1.000] | 1.000 (1/1) [0.207, 1.000] |
| nestjs | FF-P04 use-case-isolation | advisory | 0 | 0 | 1 | 0/0 | 0.000 (0/1) [0.000, 0.793] |
| nestjs | FF-P05 controller-no-entity | advisory | 0 | 1 | 0 | 0.000 (0/1) [0.000, 0.793] | 0/0 |
| nestjs | FF-P06 domain-state-purity | blocking | 1 | 0 | 0 | 1.000 (1/1) [0.207, 1.000] | 1.000 (1/1) [0.207, 1.000] |
| hexagonal | FF-S01 dependency-direction-graph | blocking | 5 | 0 | 0 | 1.000 (5/5) [0.566, 1.000] | 1.000 (5/5) [0.566, 1.000] |
| hexagonal | FF-S02 no-cyclic-deps | blocking | 1 | 0 | 0 | 1.000 (1/1) [0.207, 1.000] | 1.000 (1/1) [0.207, 1.000] |
| hexagonal | FF-S03 layer-skip-graph | advisory | 2 | 0 | 0 | 1.000 (2/2) [0.342, 1.000] | 1.000 (2/2) [0.342, 1.000] |
| hexagonal | FF-S04 core-isolation | blocking | 3 | 0 | 0 | 1.000 (3/3) [0.439, 1.000] | 1.000 (3/3) [0.439, 1.000] |
| hexagonal | FF-P01 domain-purity | blocking | 1 | 0 | 0 | 1.000 (1/1) [0.207, 1.000] | 1.000 (1/1) [0.207, 1.000] |
| hexagonal | FF-P02 port-dependency-inversion | advisory | 1 | 0 | 0 | 1.000 (1/1) [0.207, 1.000] | 1.000 (1/1) [0.207, 1.000] |
| hexagonal | FF-P03 port-adapter-pattern | blocking | 2 | 0 | 0 | 1.000 (2/2) [0.342, 1.000] | 1.000 (2/2) [0.342, 1.000] |
| hexagonal | FF-P06 domain-state-purity | blocking | 1 | 0 | 0 | 1.000 (1/1) [0.207, 1.000] | 1.000 (1/1) [0.207, 1.000] |
| ddd | FF-DS01 bounded-context-modules | deferred | 1 | 0 | 0 | 1.000 (1/1) [0.207, 1.000] | 1.000 (1/1) [0.207, 1.000] |
| ddd | FF-DS02 context-isolation | blocking | 2 | 0 | 0 | 1.000 (2/2) [0.342, 1.000] | 1.000 (2/2) [0.342, 1.000] |
| ddd | FF-DT01 aggregate-boundary | blocking | 1 | 0 | 0 | 1.000 (1/1) [0.207, 1.000] | 1.000 (1/1) [0.207, 1.000] |
| ddd | FF-DT02 repository-aggregate-root | blocking | 1 | 0 | 0 | 1.000 (1/1) [0.207, 1.000] | 1.000 (1/1) [0.207, 1.000] |
| ddd | FF-DT03 value-object-immutability | blocking | 2 | 0 | 0 | 1.000 (2/2) [0.342, 1.000] | 1.000 (2/2) [0.342, 1.000] |
| ddd | FF-DT04 domain-purity | blocking | 1 | 0 | 0 | 1.000 (1/1) [0.207, 1.000] | 1.000 (1/1) [0.207, 1.000] |
| ddd | FF-DT05 domain-event-placement | advisory | 1 | 0 | 0 | 1.000 (1/1) [0.207, 1.000] | 1.000 (1/1) [0.207, 1.000] |
| ddd | FF-DT06 application-service-thin | advisory | 1 | 0 | 0 | 1.000 (1/1) [0.207, 1.000] | 1.000 (1/1) [0.207, 1.000] |
| ddd | FF-S01 dependency-direction-graph | blocking | 1 | 0 | 0 | 1.000 (1/1) [0.207, 1.000] | 1.000 (1/1) [0.207, 1.000] |
| ddd | FF-S03 layer-skip-graph | advisory | 1 | 0 | 0 | 1.000 (1/1) [0.207, 1.000] | 1.000 (1/1) [0.207, 1.000] |

## M5 negative control (clean variants) and M6 near-miss false alarms

| Style | Clean variants with a blocking false alarm | Blocking false alarms on clean | Near-misses with a blocking false alarm |
|---|---|---|---|
| clean-architecture | 0/1 | 0 | 0.000 (0/3) [0.000, 0.561] |
| layered | 0/1 | 0 | 0.000 (0/3) [0.000, 0.561] |
| nestjs | 0/1 | 0 | 0.000 (0/3) [0.000, 0.561] |
| hexagonal | 0/1 | 0 | 0.000 (0/3) [0.000, 0.561] |
| ddd | 0/1 | 0 | 0.000 (0/2) [0.000, 0.658] |
| **pooled** | 0/5 | 0 | 0.000 (0/14) [0.000, 0.215] |

## M7 graph agreement (expected graph of the clean variant)

| Style | Edges | Edge recall (literal) | Edge precision (literal) | Layer accuracy (literal) | Adjudicated recall | Adjudicated precision | Adjudicated layer accuracy | Pending |
|---|---|---|---|---|---|---|---|---|
| clean-architecture | every edge | 1.000 (69/69) [0.947, 1.000] | 1.000 (69/69) [0.947, 1.000] | 1.000 (29/29) [0.883, 1.000] | 1.000 (69/69) [0.947, 1.000] | 1.000 (69/69) [0.947, 1.000] | 1.000 (29/29) [0.883, 1.000] | 0 |
| layered | every edge | 1.000 (62/62) [0.942, 1.000] | 1.000 (62/62) [0.942, 1.000] | 1.000 (27/27) [0.875, 1.000] | 1.000 (62/62) [0.942, 1.000] | 1.000 (62/62) [0.942, 1.000] | 1.000 (27/27) [0.875, 1.000] | 0 |
| nestjs | every edge | 1.000 (64/64) [0.943, 1.000] | 1.000 (64/64) [0.943, 1.000] | 1.000 (29/29) [0.883, 1.000] | 1.000 (64/64) [0.943, 1.000] | 1.000 (64/64) [0.943, 1.000] | 1.000 (29/29) [0.883, 1.000] | 0 |
| hexagonal | every edge | 1.000 (74/74) [0.951, 1.000] | 1.000 (74/74) [0.951, 1.000] | 1.000 (30/30) [0.886, 1.000] | 1.000 (74/74) [0.951, 1.000] | 1.000 (74/74) [0.951, 1.000] | 1.000 (30/30) [0.886, 1.000] | 0 |
| ddd | key edges only | 1.000 (16/16) [0.806, 1.000] | n/a | 1.000 (31/31) [0.890, 1.000] | 1.000 (16/16) [0.806, 1.000] | n/a | 1.000 (31/31) [0.890, 1.000] | 0 |
| **pooled (literal)** | | 1.000 (285/285) [0.987, 1.000] | 1.000 (269/269) [0.986, 1.000] | 1.000 (146/146) [0.974, 1.000] | | | | |


## Every blocking miss and false alarm

| Style | Variant | Kind | Mismatch | Rule | File | Target | Note |
|---|---|---|---|---|---|---|---|
