## Corpus walked

| id | commits on path | sampled | valid pairs | bot / mass pairs | files (last) | items (last) | snapshots | errors | median s/snapshot | wall s |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| amplication-server | 826 | 100 | 99 | 3 / 2 | 875 | 1252 | 200 | 1 | 3.8 | 1019 |

Valid pairs: 99. Non-bot valid commits: 96; with architecture words: 4 = 4.17% [1.63%, 10.23%].

## Fix rates by group

Exposure = an item (or baseline edge) present at the parent of a valid sampled pair. Credited = FIXED-BY-DEV (edge, component dependency) or RESOLVED-IN-PLACE (member, pair, file, metric); baselines: FIXED-BY-DEV only.

| group | exposures | credited | rate [Wilson 95%] | vs (a) cross-layer: RR [95%] | repo-boot 95% | vs (b) pkg: RR [95%] | repo-boot 95% | h (a) / h (b) | fix commits | RR without top commit | RR one credit per commit | repos above (a) | arch words in fix commits |
|---|---:|---:|---|---|---|---|---|---|---:|---|---|---|---|
| APG v2, blocking-tier templates | 382 | 0 | 0.00% [0.00%, 1.00%] | 6.32 [0.34, 117.11] | [0.00, 0.00] | 1.83 [0.11, 29.62] | [0.00, 0.00] | -0.027 / -0.053 | 0 | 6.32 [0.34, 117.11] | 11.37 [0.55, 236.42] | 0/1 (p=1.000) | 0/0 (n/a) |
| APG v2, advisory-tier templates | 11812 | 4 | 0.034% [0.013%, 0.087%] | 1.84 [0.46, 7.36] | [1.84, 1.84] | 0.48 [0.17, 1.33] | [0.48, 0.48] | 0.010 / -0.016 | 3 | 0.92 [0.17, 5.02] | 2.76 [0.46, 16.52] | 1/1 (p=1.000) | 1/3 (33.33% [6.15%, 79.23%]) |
| cheap proxies (all advisory) | 24516 | 74 | 0.30% [0.24%, 0.38%] | 16.41 [6.00, 44.87] | [16.41, 16.41] | 4.27 [2.93, 6.21] | [4.27, 4.27] | 0.083 / 0.057 | 13 | 12.64 [4.59, 34.83] | 5.77 [1.30, 25.54] | 1/1 (p=1.000) | 1/13 (7.69% [1.37%, 33.31%]) |
| APG v2, import-graph-invisible | 1620 | 3 | 0.19% [0.063%, 0.54%] | 10.07 [2.25, 44.94] | [10.07, 10.07] | 2.62 [0.81, 8.43] | [2.62, 2.62] | 0.059 / 0.033 | 3 | 6.71 [1.23, 36.61] | 20.13 [3.37, 120.40] | 1/1 (p=1.000) | 1/3 (33.33% [6.15%, 79.23%]) |
| APG v2, import-graph-visible | 10574 | 1 | 0.009% [0.002%, 0.054%] | 0.51 [0.06, 4.60] | [0.51, 0.51] | 0.13 [0.02, 0.97] | [0.13, 0.13] | -0.008 / -0.034 | 1 | 0.23 [0.01, 4.24] | 1.03 [0.09, 11.34] | 0/1 (p=1.000) | 1/1 (100.00% [20.65%, 100.00%]) |
| proxies, import-graph-invisible | 11112 | 29 | 0.26% [0.18%, 0.37%] | 14.19 [4.99, 40.34] | [14.19, 14.19] | 3.69 [2.30, 5.91] | [3.69, 3.69] | 0.075 / 0.049 | 8 | 11.25 [3.89, 32.53] | 7.83 [1.66, 36.85] | 1/1 (p=1.000) | 1/8 (12.50% [2.24%, 47.09%]) |
| proxies, import-graph-visible | 13404 | 45 | 0.34% [0.25%, 0.45%] | 18.25 [6.57, 50.73] | [18.25, 18.25] | 4.75 [3.13, 7.21] | [4.75, 4.75] | 0.089 / 0.063 | 8 | 11.36 [3.98, 32.37] | 6.49 [1.38, 30.55] | 1/1 (p=1.000) | 0/8 (0.00% [0.00%, 32.44%]) |
| all import-graph-invisible items | 12732 | 32 | 0.25% [0.18%, 0.35%] | 13.66 [4.83, 38.62] | [13.66, 13.66] | 3.55 [2.25, 5.61] | [3.55, 3.55] | 0.073 / 0.047 | 10 | 11.10 [3.88, 31.80] | 8.54 [1.87, 38.97] | 1/1 (p=1.000) | 1/10 (10.00% [1.79%, 40.42%]) |
| baseline (a): unflagged cross-layer import edges | 21744 | 4 | 0.018% [0.007%, 0.047%] | 1.00 [0.25, 4.00] | [1.00, 1.00] | 0.26 [0.09, 0.72] | [0.26, 0.26] | 0.000 / -0.026 | 2 | 0.50 [0.09, 2.73] | 1.00 [0.14, 7.10] | 0/0 (p=1.000) | 1/2 (50.00% [9.45%, 90.55%]) |
| baseline (a): unflagged layered import edges | 95630 | 56 | 0.059% [0.045%, 0.076%] | 3.18 [1.15, 8.78] | [3.18, 3.18] | 0.83 [0.56, 1.23] | [0.83, 0.83] | 0.021 / -0.005 | 6 | 1.08 [0.37, 3.17] | 0.68 [0.14, 3.38] | 1/1 (p=1.000) | 1/6 (16.67% [3.01%, 56.35%]) |
| baseline (a): all unflagged internal import edges | 102718 | 63 | 0.061% [0.048%, 0.078%] | 3.33 [1.21, 9.16] | [3.33, 3.33] | 0.87 [0.59, 1.28] | [0.87, 0.87] | 0.022 / -0.004 | 7 | 1.38 [0.48, 3.94] | 0.74 [0.15, 3.57] | 1/1 (p=1.000) | 1/7 (14.29% [2.57%, 51.31%]) |
| baseline (b): file -> package imports | 60785 | 43 | 0.071% [0.053%, 0.095%] | 3.85 [1.38, 10.71] | [3.85, 3.85] | 1.00 [0.66, 1.53] | [1.00, 1.00] | 0.026 / 0.000 | 6 | 0.80 [0.25, 2.61] | 1.07 [0.22, 5.32] | 1/1 (p=1.000) | 0/6 (0.00% [0.00%, 39.03%]) |

### Touched pairs only

Exposures restricted to pairs whose commit touched a file the item (edge, package import) names.

| group | exposures in touched pairs | credited | rate [Wilson 95%] | vs (a) cross-layer touched: RR [95%] | vs (b) pkg touched: RR [95%] |
|---|---:|---:|---|---|---|
| APG v2, blocking-tier templates | 0 | 0 | n/a | n/a | n/a |
| APG v2, advisory-tier templates | 395 | 2 | 0.51% [0.14%, 1.83%] | 0.86 [0.16, 4.69] | 0.10 [0.03, 0.43] |
| cheap proxies (all advisory) | 1039 | 40 | 3.85% [2.84%, 5.20%] | 6.55 [2.36, 18.24] | 0.79 [0.52, 1.20] |
| APG v2, import-graph-invisible | 116 | 1 | 0.86% [0.15%, 4.72%] | 1.47 [0.17, 13.02] | 0.18 [0.02, 1.27] |
| APG v2, import-graph-visible | 279 | 1 | 0.36% [0.063%, 2.00%] | 0.61 [0.07, 5.44] | 0.07 [0.01, 0.53] |
| proxies, import-graph-invisible | 442 | 11 | 2.49% [1.40%, 4.40%] | 4.24 [1.36, 13.22] | 0.51 [0.26, 0.98] |
| proxies, import-graph-visible | 597 | 29 | 4.86% [3.40%, 6.89%] | 8.27 [2.92, 23.39] | 0.99 [0.63, 1.57] |
| all import-graph-invisible items | 558 | 12 | 2.15% [1.23%, 3.72%] | 3.66 [1.19, 11.29] | 0.44 [0.23, 0.83] |
| baseline (a): unflagged cross-layer import edges | 681 | 4 | 0.59% [0.23%, 1.50%] | 1.00 [0.25, 3.98] | 0.12 [0.04, 0.33] |
| baseline (a): unflagged layered import edges | 2524 | 56 | 2.22% [1.71%, 2.87%] | 3.78 [1.37, 10.38] | 0.45 [0.31, 0.67] |
| baseline (a): all unflagged internal import edges | 2833 | 63 | 2.22% [1.74%, 2.83%] | 3.79 [1.38, 10.37] | 0.45 [0.31, 0.66] |
| baseline (b): file -> package imports | 879 | 43 | 4.89% [3.65%, 6.52%] | 8.33 [3.00, 23.09] | 1.00 [0.66, 1.51] |

## Fix rates by template and proxy

| group | exposures | credited | rate [Wilson 95%] | vs (a) cross-layer: RR [95%] | repo-boot 95% | vs (b) pkg: RR [95%] | repo-boot 95% | h (a) / h (b) | fix commits | RR without top commit | RR one credit per commit | repos above (a) | arch words in fix commits |
|---|---:|---:|---|---|---|---|---|---|---:|---|---|---|---|
| component-adp-cycle (blocking) | 382 | 0 | 0.00% [0.00%, 1.00%] | 6.32 [0.34, 117.11] | [0.00, 0.00] | 1.83 [0.11, 29.62] | [0.00, 0.00] | -0.027 / -0.053 | 0 | 6.32 [0.34, 117.11] | 11.37 [0.55, 236.42] | 0/1 (p=1.000) | 0/0 (n/a) |
| component-main-sequence-distance (advisory) | 217 | 2 | 0.92% [0.25%, 3.30%] | 50.10 [9.23, 272.10] | [50.10, 50.10] | 13.03 [3.18, 53.44] | [13.03, 13.03] | 0.165 / 0.139 | 2 | 25.05 [2.81, 223.21] | 100.20 [14.18, 708.11] | 1/1 (p=1.000) | 1/2 (50.00% [9.45%, 90.55%]) |
| component-sdp-violation (advisory) | 291 | 0 | 0.00% [0.00%, 1.30%] | 8.29 [0.45, 153.59] | [0.00, 0.00] | 2.40 [0.15, 38.84] | [0.00, 0.00] | -0.027 / -0.053 | 0 | 8.29 [0.45, 153.59] | 14.92 [0.72, 310.07] | 0/1 (p=1.000) | 0/0 (n/a) |
| deep-import-inferred-api (advisory) | 9885 | 1 | 0.010% [0.002%, 0.057%] | 0.55 [0.06, 4.92] | [0.55, 0.55] | 0.14 [0.02, 1.04] | [0.14, 0.14] | -0.007 / -0.033 | 1 | 0.24 [0.01, 4.54] | 1.10 [0.10, 12.13] | 0/1 (p=1.000) | 1/1 (100.00% [20.65%, 100.00%]) |
| nondeterminism-in-core (advisory) | 1419 | 1 | 0.070% [0.012%, 0.40%] | 3.83 [0.43, 34.25] | [3.83, 3.83] | 1.00 [0.14, 7.23] | [1.00, 1.00] | 0.026 / -0.000 | 1 | 1.70 [0.09, 31.60] | 7.66 [0.70, 84.44] | 1/1 (p=1.000) | 0/1 (0.00% [0.00%, 79.35%]) |
| clones/cross-component-exact-structural | 56 | 0 | 0.00% [0.00%, 6.42%] | 42.76 [2.33, 785.02] | [0.00, 0.00] | 12.37 [0.77, 198.43] | [0.00, 0.00] | -0.027 / -0.053 | 0 | 42.76 [2.33, 785.02] | 76.97 [3.74, 1585.34] | 0/1 (p=1.000) | 0/0 (n/a) |
| clones/same-component-exact-structural | 4548 | 8 | 0.18% [0.089%, 0.35%] | 9.56 [2.88, 31.74] | [9.56, 9.56] | 2.49 [1.17, 5.29] | [2.49, 2.49] | 0.057 / 0.031 | 2 | 4.78 [1.20, 19.11] | 4.78 [0.67, 33.93] | 1/1 (p=1.000) | 0/2 (0.00% [0.00%, 65.76%]) |
| clones/same-component-guard | 2516 | 8 | 0.32% [0.16%, 0.63%] | 17.28 [5.21, 57.36] | [17.28, 17.28] | 4.49 [2.12, 9.55] | [4.49, 4.49] | 0.086 / 0.060 | 2 | 4.32 [0.79, 23.58] | 8.64 [1.22, 61.33] | 1/1 (p=1.000) | 0/2 (0.00% [0.00%, 65.76%]) |
| clones/same-component-near | 6270 | 16 | 0.26% [0.16%, 0.41%] | 13.87 [4.64, 41.48] | [13.87, 13.87] | 3.61 [2.03, 6.40] | [3.61, 3.61] | 0.074 / 0.048 | 6 | 10.40 [3.36, 32.25] | 10.40 [2.10, 51.53] | 1/1 (p=1.000) | 0/6 (0.00% [0.00%, 39.03%]) |
| cohesion/broad-responsibility | 1046 | 1 | 0.096% [0.017%, 0.54%] | 5.20 [0.58, 46.46] | [5.20, 5.20] | 1.35 [0.19, 9.80] | [1.35, 1.35] | 0.035 / 0.009 | 1 | 2.31 [0.12, 42.85] | 10.39 [0.94, 114.53] | 1/1 (p=1.000) | 0/1 (0.00% [0.00%, 79.35%]) |
| cohesion/low-cohesion | 567 | 1 | 0.18% [0.031%, 0.99%] | 9.59 [1.07, 85.64] | [9.59, 9.59] | 2.49 [0.34, 18.07] | [2.49, 2.49] | 0.057 / 0.031 | 1 | 4.26 [0.23, 78.98] | 19.17 [1.74, 211.16] | 1/1 (p=1.000) | 1/1 (100.00% [20.65%, 100.00%]) |
| communities/community-component-mismatch | 3450 | 21 | 0.61% [0.40%, 0.93%] | 33.09 [11.37, 96.34] | [33.09, 33.09] | 8.60 [5.11, 14.48] | [8.60, 8.60] | 0.129 / 0.103 | 6 | 23.63 [7.85, 71.17] | 18.91 [3.82, 93.64] | 1/1 (p=1.000) | 1/6 (16.67% [3.01%, 56.35%]) |
| config-surface/env-read-outside-config | 20 | 0 | 0.00% [0.00%, 16.11%] | 117.86 [6.55, 2119.49] | [0.00, 0.00] | 34.08 [2.17, 535.20] | [0.00, 0.00] | -0.027 / -0.053 | 0 | 117.86 [6.55, 2119.49] | 212.14 [10.51, 4283.70] | 0/1 (p=1.000) | 0/0 (n/a) |
| logic-density/adapter-logic-density | 77 | 0 | 0.00% [0.00%, 4.75%] | 31.17 [1.69, 574.12] | [0.00, 0.00] | 9.02 [0.56, 145.14] | [0.00, 0.00] | -0.027 / -0.053 | 0 | 31.17 [1.69, 574.12] | 56.11 [2.72, 1159.29] | 0/1 (p=1.000) | 0/0 (n/a) |
| logic-density/controller-logic-density | 45 | 0 | 0.00% [0.00%, 7.87%] | 53.10 [2.90, 972.05] | [0.00, 0.00] | 15.36 [0.96, 245.67] | [0.00, 0.00] | -0.027 / -0.053 | 0 | 53.10 [2.90, 972.05] | 95.58 [4.65, 1963.27] | 0/1 (p=1.000) | 0/0 (n/a) |
| name-behaviour/controller-business-logic | 45 | 0 | 0.00% [0.00%, 7.87%] | 53.10 [2.90, 972.05] | [0.00, 0.00] | 15.36 [0.96, 245.67] | [0.00, 0.00] | -0.027 / -0.053 | 0 | 53.10 [2.90, 972.05] | 95.58 [4.65, 1963.27] | 0/1 (p=1.000) | 0/0 (n/a) |
| reachability/unreachable-module | 4578 | 19 | 0.42% [0.27%, 0.65%] | 22.56 [7.68, 66.29] | [22.56, 22.56] | 5.87 [3.42, 10.06] | [5.87, 5.87] | 0.102 / 0.076 | 3 | 2.37 [0.44, 12.96] | 7.12 [1.19, 42.63] | 1/1 (p=1.000) | 0/3 (0.00% [0.00%, 56.15%]) |
| sdk-spread/vendor-sdk-outside-adapters | 950 | 0 | 0.00% [0.00%, 0.40%] | 2.54 [0.14, 47.18] | [0.00, 0.00] | 0.74 [0.05, 11.93] | [0.00, 0.00] | -0.027 / -0.053 | 0 | 2.54 [0.14, 47.18] | 4.58 [0.22, 95.24] | 0/1 (p=1.000) | 0/0 (n/a) |
| shared-literals/shared-number-literal | 325 | 0 | 0.00% [0.00%, 1.17%] | 7.42 [0.40, 137.58] | [0.00, 0.00] | 2.15 [0.13, 34.79] | [0.00, 0.00] | -0.027 / -0.053 | 0 | 7.42 [0.40, 137.58] | 13.36 [0.64, 277.75] | 0/1 (p=1.000) | 0/0 (n/a) |
| vocabulary/vocabulary-leakage | 23 | 0 | 0.00% [0.00%, 14.31%] | 102.81 [5.69, 1856.58] | [0.00, 0.00] | 29.73 [1.89, 468.91] | [0.00, 0.00] | -0.027 / -0.053 | 0 | 102.81 [5.69, 1856.58] | 185.06 [9.13, 3751.73] | 0/1 (p=1.000) | 0/0 (n/a) |

### Touched pairs only

| group | exposures in touched pairs | credited | rate [Wilson 95%] | vs (a) cross-layer touched: RR [95%] | vs (b) pkg touched: RR [95%] |
|---|---:|---:|---|---|---|
| component-adp-cycle (blocking) | 0 | 0 | n/a | n/a | n/a |
| component-main-sequence-distance (advisory) | 0 | 0 | n/a | n/a | n/a |
| component-sdp-violation (advisory) | 0 | 0 | n/a | n/a | n/a |
| deep-import-inferred-api (advisory) | 279 | 1 | 0.36% [0.063%, 2.00%] | 0.61 [0.07, 5.44] | 0.07 [0.01, 0.53] |
| nondeterminism-in-core (advisory) | 116 | 1 | 0.86% [0.15%, 4.72%] | 1.47 [0.17, 13.02] | 0.18 [0.02, 1.27] |
| clones/cross-component-exact-structural | 0 | 0 | n/a | n/a | n/a |
| clones/same-component-exact-structural | 282 | 8 | 2.84% [1.44%, 5.50%] | 4.83 [1.47, 15.91] | 0.58 [0.28, 1.22] |
| clones/same-component-guard | 230 | 8 | 3.48% [1.77%, 6.71%] | 5.92 [1.80, 19.48] | 0.71 [0.34, 1.49] |
| clones/same-component-near | 346 | 16 | 4.62% [2.87%, 7.38%] | 7.87 [2.65, 23.37] | 0.95 [0.54, 1.66] |
| cohesion/broad-responsibility | 28 | 1 | 3.57% [0.63%, 17.71%] | 6.08 [0.70, 52.64] | 0.73 [0.10, 5.11] |
| cohesion/low-cohesion | 14 | 1 | 7.14% [1.27%, 31.47%] | 12.16 [1.45, 101.97] | 1.46 [0.22, 9.87] |
| communities/community-component-mismatch | 44 | 3 | 6.82% [2.35%, 18.23%] | 11.61 [2.68, 50.26] | 1.39 [0.45, 4.32] |
| config-surface/env-read-outside-config | 0 | 0 | n/a | n/a | n/a |
| logic-density/adapter-logic-density | 0 | 0 | n/a | n/a | n/a |
| logic-density/controller-logic-density | 0 | 0 | n/a | n/a | n/a |
| name-behaviour/controller-business-logic | 0 | 0 | n/a | n/a | n/a |
| reachability/unreachable-module | 51 | 3 | 5.88% [2.02%, 15.92%] | 10.01 [2.30, 43.54] | 1.20 [0.39, 3.74] |
| sdk-spread/vendor-sdk-outside-adapters | 28 | 0 | 0.00% [0.00%, 12.06%] | 2.66 [0.15, 48.17] | 0.35 [0.02, 5.62] |
| shared-literals/shared-number-literal | 16 | 0 | 0.00% [0.00%, 19.36%] | 4.59 [0.26, 81.81] | 0.61 [0.04, 9.53] |
| vocabulary/vocabulary-leakage | 0 | 0 | n/a | n/a | n/a |

## Within a rule: import-graph-invisible vs visible items

| rule | invisible exposures | credited | rate | visible exposures | credited | rate | RR invisible / visible |
|---|---:|---:|---|---:|---:|---|---|
| nondeterminism-in-core | 1403 | 1 | 0.071% [0.013%, 0.40%] | 16 | 0 | 0.00% [0.00%, 19.36%] | 0.04 [0.00, 0.83] |
| clones/same-component-exact-structural | 2110 | 4 | 0.19% [0.074%, 0.49%] | 2438 | 4 | 0.16% [0.064%, 0.42%] | 1.16 [0.29, 4.61] |
| clones/same-component-guard | 254 | 0 | 0.00% [0.00%, 1.49%] | 2262 | 8 | 0.35% [0.18%, 0.70%] | 0.52 [0.03, 9.03] |
| clones/same-component-near | 3094 | 2 | 0.065% [0.018%, 0.24%] | 3176 | 14 | 0.44% [0.26%, 0.74%] | 0.15 [0.03, 0.64] |

## Member-level credited removals: was the member itself kept?

| rule | member still declared | member gone (deleted or renamed in place) |
|---|---:|---:|
| nondeterminism-in-core | 0 | 1 |

## Survival (grid lineages, left-censored excluded)

| group | lineages | ended | KM median days | S(365 d) | ends with files in place |
|---|---:|---:|---|---|---|
| APG v2, blocking-tier templates | 20 | 2 | > window | 0.950 | 100.00% |
| APG v2, advisory-tier templates | 501 | 123 | > window | 0.860 | 26.02% |
| cheap proxies (all advisory) | 1600 | 745 | 808 | 0.649 | 79.60% |
| APG v2, import-graph-invisible | 57 | 21 | > window | 0.807 | 61.90% |
| APG v2, import-graph-visible | 464 | 104 | > window | 0.871 | 20.19% |
| proxies, import-graph-invisible | 799 | 282 | > window | 0.737 | 82.98% |
| proxies, import-graph-visible | 801 | 463 | 543 | 0.564 | 77.54% |
| all import-graph-invisible items | 856 | 303 | > window | 0.742 | 81.52% |
| component-adp-cycle | 20 | 2 | > window | 0.950 | 100.00% |
| component-main-sequence-distance | 6 | 2 | > window | 0.667 | 100.00% |
| component-sdp-violation | 15 | 7 | > window | 0.667 | 100.00% |
| deep-import-inferred-api | 428 | 95 | > window | 0.874 | 12.63% |
| nondeterminism-in-core | 52 | 19 | > window | 0.827 | 57.89% |
| unflagged cross-layer import edges | 863 | 145 | > window | 0.909 | 35.17% |
| unflagged layered import edges | 3314 | 726 | > window | 0.905 | 23.55% |
| all unflagged import edges | 3712 | 849 | > window | 0.885 | 23.09% |

## Example fix commits (seeded draw)

| # | repository | commit | rule | import-graph | item | commit message |
|---|---|---|---|---|---|---|
| 1 | amplication-server | [0839158c26](https://github.com/amplication/amplication/commit/0839158c26758344692e75abacca65ab67296ea7) | component-main-sequence-distance | invisible | folder core D=0.987 (A=0.013, I=0) (``) | Merge pull request #55 from amplication/refactor/resource-decorators — Resource Paramater Decorators |
| 2 | amplication-server | [ea7df7a4d5](https://github.com/amplication/amplication/commit/ea7df7a4d5e4d43d3a509fab333dcc25360bea4b) | nondeterminism-in-core | invisible | AssistantService.handleRunStatus (application) reads clock: Date.now(), new Date() (`src/core/assistant/assistant.service.ts`) | Merge pull request #8440 from amplication/next — Release v1.17.0 |
| 3 | amplication-server | [0cac982221](https://github.com/amplication/amplication/commit/0cac98222106eaead3a59ec3a2bce06ffbc3acda) | clones/same-component-exact-structural | invisible | body clone (exact-structural, similarity 1.00) of EntityResolver.entityVersions in component core (`src/core/app/app.resolver.ts -> src/core/entity/entity.resolver.ts`) | Merge pull request #460 from amplication/fix/entity-versions — Fix entityVersions and fieldPermanentId |
| 4 | amplication-server | [b7ad162551](https://github.com/amplication/amplication/commit/b7ad16255117fd0b3466eda4f6d0d3ec3ea1701f) | clones/same-component-near | invisible | body clone (near, similarity 0.81) of EntityService.getChangedEntities in component core (`src/core/block/block.service.ts -> src/core/entity/entity.service.ts`) | Merge pull request #5040 from amplication/next — Next |
| 5 | amplication-server | [bb5943b1b7](https://github.com/amplication/amplication/commit/bb5943b1b79b0cdeeab09f0e38909caf54f4cf5d) | communities/community-component-mismatch | invisible | src/core/app/dto/EnumPendingChangeAction.ts (component core) clusters with community 10 whose majority component is models (`src/core/app/dto/EnumPendingChangeAction.ts`) | Merge pull request #1114 from amplication/feat/sync-with-guthub — Sync with GitHub |
| 6 | amplication-server | [fb8978f162](https://github.com/amplication/amplication/commit/fb8978f162b74029293bbdf49f27579256815196) | reachability/unreachable-module | visible | no entry point reaches src/core/deployment/deployment.resolver.ts (1 entries) (`src/core/deployment/deployment.resolver.ts`) | Merge pull request #584 from amplication/feature/deployment-client — Deployment dialog |
| 7 | amplication-server | [10ae924977](https://github.com/amplication/amplication/commit/10ae9249779ab90cc55a5479145f7ea1fcc67437) | communities/community-component-mismatch | invisible | src/core/app/dto/EnumPendingChangeResourceType.ts (component core) clusters with community 14 whose majority component is models (`src/core/app/dto/EnumPendingChangeResourceType.ts`) | Merge pull request #2581 from amplication/release/0.12.4 — Release/0.12.4 |
| 8 | amplication-server | [56f3460fc3](https://github.com/amplication/amplication/commit/56f3460fc39ded200d97539c2ca9b819f596bc27) | communities/community-component-mismatch | invisible | src/services/googleSecretsManager.module.ts (component services) clusters with community 0 whose majority component is core (`src/services/googleSecretsManager.module.ts`) | Merge pull request #6229 from amplication/next — chore: Merge next into master (1.7.2) |
| 9 | amplication-server | [c0a59d0e61](https://github.com/amplication/amplication/commit/c0a59d0e61bebce4e97ed3d6e1bf1a1ab0a876d1) | clones/same-component-near | visible | body clone (near, similarity 0.84) of EntityService.updateEntityPermission in component core (`src/core/entity/entity.service.ts`) | Merge pull request #233 from amplication/feature/entity-update-roles-batch — Update roles in batch |
| 10 | amplication-server | [cb69a50e30](https://github.com/amplication/amplication/commit/cb69a50e3082e06916ac30b81b6b17877473ffc1) | reachability/unreachable-module | visible | no entry point reaches src/util/softDelete.ts (1 entries) (`src/util/softDelete.ts`) | Merge pull request #1419 from amplication/feat/delete-app — feat(client):delete app |
| 11 | amplication-server | [297e99e249](https://github.com/amplication/amplication/commit/297e99e24989b3f119955d3a5694adb62af8e30e) | clones/same-component-near | visible | body clone (near, similarity 0.80) of ProjectService.createProject in component core (`src/core/resource/resource.service.ts -> src/core/project/project.service.ts`) | Merge pull request #4689 from amplication/next — Next release |
| 12 | amplication-server | [eaf9eae7d6](https://github.com/amplication/amplication/commit/eaf9eae7d60722cd75ecf0315f97a5f09632e814) | communities/community-component-mismatch | invisible | src/models/index.ts (component models) clusters with community 0 whose majority component is core (`src/models/index.ts`) | Merge pull request #14 from amplication/feature/apps-view — Apps View |
| 13 | amplication-server | [ce020af2ef](https://github.com/amplication/amplication/commit/ce020af2ef3d466e5a2a60d0ee4cb0d9e1fc66ba) | communities/community-component-mismatch | invisible | src/decorators/user.decorator.ts (component decorators) clusters with community 48 whose majority component is models (`src/decorators/user.decorator.ts`) | Merge pull request #93 from amplication/lint/imports — Lint Imports |

