## Corpus

| id | source | style | commits on path | sampled | valid pairs | files (last sample) | blocking findings (last) | bot / mass pairs | wall s |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| hoppscotch-backend | v1.3-wild | nestjs | 319 | 200 | 199 | 189 | 19 | 0 / 7 | 569 |
| immich-server | v1.3-wild | nestjs | 3601 | 200 | 169 | 458 | 192 | 42 / 1 | 1445 |
| podkrepi-api | v1.3-wild | nestjs | 455 | 200 | 200 | 576 | 159 | 0 / 4 | 800 |
| hedgedoc-backend | v1.3-wild | nestjs | 1151 | 200 | 199 | 203 | 11 | 125 / 3 | 636 |
| awesome-nest-boilerplate | v1.3-wild | nestjs | 336 | 200 | 200 | 98 | 26 | 1 / 22 | 650 |
| mikro-orm-realworld | v1.3-wild | nestjs | 1079 | 200 | 200 | 39 | 9 | 184 / 3 | 277 |
| clean-ts-api | v1.3-wild | clean-architecture | 576 | 200 | 197 | 180 | 13 | 0 / 13 | 312 |
| standardnotes-auth | v1.3-wild | clean-architecture | 1201 | 200 | 199 | 469 | 166 | 0 / 0 | 978 |
| domain-driven-hexagon | v1.3-wild | hexagonal | 445 | 200 | 200 | 82 | 30 | 0 / 2 | 724 |
| bitloops-ddd-backend | v1.3-wild | hexagonal | 21 | 21 | 20 | 164 | 73 | 1 / 7 | 32 |
| medplum-server | v1.3-wild | layered | 2997 | 200 | 199 | 491 | 296 | 0 / 3 | 1627 |
| ts-express-starter-prisma | v1.3-wild | layered | 1 | 1 | 0 | 34 | 5 | 0 / 0 | 0 |
| reactive-resume-api | v1.3-wild | layered | 127 | 127 | 125 | 115 | 101 | 2 / 15 | 142 |
| etherpad | v1.3-wild | layered | 3948 | 200 | 64 | 133 | 91 | 32 / 3 | 312 |
| pvarentsov-clean | v1.3-external | clean-architecture | 214 | 200 | 197 | 184 | 18 | 1 / 20 | 208 |
| luizomf-clean-api | v1.3-external | clean-architecture | 162 | 161 | 161 | 125 | 9 | 0 / 9 | 130 |
| dannielhugo-clean | v1.3-external | clean-architecture | 83 | 82 | 82 | 69 | 0 | 0 / 36 | 4 |
| bulletproof-nodejs | v1.3-external | layered | 48 | 47 | 47 | 25 | 0 | 0 / 9 | 26 |
| w3tec-express-boilerplate | v1.3-external | layered | 73 | 72 | 72 | 58 | 8 | 0 / 20 | 63 |
| talento90-typescript-node | v1.3-external | layered | 88 | 87 | 85 | 35 | 4 | 0 / 29 | 57 |
| zeldaplay-api | v1.3-external | nestjs | 35 | 35 | 34 | 85 | 0 | 0 / 7 | 40 |
| neoteric-nestjs-auth | v1.3-external | nestjs | 8 | 7 | 5 | 183 | 72 | 0 / 2 | 11 |
| vivify-nestjs-boilerplate | v1.3-external | nestjs | 29 | 28 | 28 | 33 | 6 | 3 / 10 | 21 |
| conduit-ports-adapters | v1.3-external | hexagonal | 103 | 102 | 96 | 36 | 0 | 0 / 39 | 63 |
| ddialar-hexagonal-boilerplate | v1.3-external | hexagonal | 5 | 4 | 4 | 19 | 0 | 0 / 1 | 0 |
| nest-products-hexagonal | v1.3-external | hexagonal | 22 | 21 | 21 | 23 | 3 | 0 / 4 | 13 |
| ddd-forum | v1.3-external | ddd | 119 | 118 | 117 | 248 | 92 | 0 / 24 | 107 |
| finance-project-ddd | v1.3-external | ddd | 245 | 200 | 200 | 166 | 48 | 0 / 83 | 339 |
| event-sourcing-ddd | v1.3-external | ddd | 5 | 4 | 4 | 58 | 20 | 0 / 1 | 0 |
| ghostfolio-api | added | nestjs | 1988 | 200 | 200 | 334 | 161 | 0 / 1 | 1037 |
| directus-api | added | layered | 3305 | 200 | 199 | 845 | 199 | 20 / 2 | 1104 |
| outline-server | added | layered | 3124 | 200 | 151 | 552 | 312 | 4 / 0 | 1028 |
| logto-core | added | layered | 2744 | 200 | 199 | 559 | 179 | 5 / 5 | 1051 |
| unleash | added | layered | 3359 | 200 | 199 | 941 | 156 | 7 / 1 | 1878 |
| budibase-server | added | layered | 4160 | 200 | 169 | 594 | 249 | 0 / 4 | 799 |
| amplication-server | added | nestjs | 826 | 200 | 199 | 875 | 125 | 6 / 5 | 967 |

## Removal rate per exposure (all repositories)

Exposure = a finding (or unflagged edge) present at the parent of a sampled commit. Credited = FIXED-BY-DEV for edge-shaped findings and baseline edges; RESOLVED-IN-PLACE for file-level findings (not an edge removal; shown for comparison only).

| group | exposures | credited removals | rate [Wilson 95%] | vs cross-layer baseline: rate ratio [95%] | repo-bootstrap 95% | Cohen h | fix commits | with architecture words |
|---|---:|---:|---|---|---|---:|---:|---|
| blocking, edge-shaped | 178159 | 74 | 0.042% [0.033%, 0.052%] | 2.65 [1.97, 3.56] | [0.37, 7.54] | 0.016 | 14 | 5 (35.71% [16.34%, 61.24%]) |
| advisory, edge-shaped | 831 | 1 | 0.12% [0.021%, 0.68%] | 7.67 [1.07, 54.89] | [0.00, 72.86] | 0.044 | 1 | 1 (100.00% [20.65%, 100.00%]) |
| advisory, file-level (resolved in place) | 859267 | 157 | 0.018% [0.016%, 0.021%] | 1.17 [0.91, 1.49] | [0.69, 1.81] | 0.002 | 97 | 34 (35.05% [26.29%, 44.95%]) |
| blocking, file-level (resolved in place) | 29890 | 7 | 0.023% [0.011%, 0.048%] | 1.49 [0.70, 3.21] | [0.19, 3.33] | 0.006 | 5 | 1 (20.00% [3.62%, 62.45%]) |
| baseline: unflagged cross-layer import edges | 701376 | 110 | 0.016% [0.013%, 0.019%] | — | — | — | 55 | 21 (38.18% [26.52%, 51.39%]) |
| baseline: unflagged layered import edges | 1829131 | 225 | 0.012% [0.011%, 0.014%] | 0.78 [0.62, 0.99] | [0.61, 0.95] | -0.003 | 102 | 36 (35.29% [26.71%, 44.95%]) |
| baseline: all unflagged internal import edges | 3270876 | 409 | 0.013% [0.011%, 0.014%] | 0.80 [0.65, 0.98] | [0.50, 1.14] | -0.003 | 185 | 59 (31.89% [25.60%, 38.92%]) |

Base rate of architecture words over every non-bot sampled commit: 677 / 4207 = 16.09% [15.01%, 17.23%].

## Removal rate per exposure (repositories with >= 300 commits on the path)

Exposure = a finding (or unflagged edge) present at the parent of a sampled commit. Credited = FIXED-BY-DEV for edge-shaped findings and baseline edges; RESOLVED-IN-PLACE for file-level findings (not an edge removal; shown for comparison only).

| group | exposures | credited removals | rate [Wilson 95%] | vs cross-layer baseline: rate ratio [95%] | repo-bootstrap 95% | Cohen h | fix commits | with architecture words |
|---|---:|---:|---|---|---|---:|---:|---|
| blocking, edge-shaped | 158710 | 65 | 0.041% [0.032%, 0.052%] | 3.32 [2.37, 4.63] | [0.26, 9.66] | 0.018 | 10 | 5 (50.00% [23.66%, 76.34%]) |
| advisory, edge-shaped | 62 | 1 | 1.61% [0.29%, 8.59%] | 130.60 [18.44, 924.96] | [79.04, 212.83] | 0.232 | 1 | 1 (100.00% [20.65%, 100.00%]) |
| advisory, file-level (resolved in place) | 785612 | 113 | 0.014% [0.012%, 0.017%] | 1.16 [0.87, 1.56] | [0.68, 1.87] | 0.002 | 70 | 28 (40.00% [29.33%, 51.71%]) |
| blocking, file-level (resolved in place) | 29175 | 6 | 0.021% [0.009%, 0.045%] | 1.67 [0.72, 3.83] | [0.00, 4.11] | 0.006 | 4 | 1 (25.00% [4.56%, 69.94%]) |
| baseline: unflagged cross-layer import edges | 591113 | 73 | 0.012% [0.010%, 0.016%] | — | — | — | 41 | 19 (46.34% [32.06%, 61.25%]) |
| baseline: unflagged layered import edges | 1621064 | 159 | 0.010% [0.008%, 0.011%] | 0.79 [0.60, 1.05] | [0.60, 0.99] | -0.002 | 74 | 31 (41.89% [31.32%, 53.26%]) |
| baseline: all unflagged internal import edges | 3018187 | 318 | 0.011% [0.009%, 0.012%] | 0.85 [0.66, 1.10] | [0.49, 1.26] | -0.002 | 148 | 50 (33.78% [26.66%, 41.73%]) |

Base rate of architecture words over every non-bot sampled commit: 469 / 2916 = 16.08% [14.79%, 17.46%].

## Per repository

Blocking edge-shaped removal rate against the cross-layer baseline rate, per repository with at least one blocking edge-shaped exposure.

| id | blocking exposures | blocking FIXED-BY-DEV | rate | cross-layer exposures | cross-layer FIXED-BY-DEV | rate | blocking > baseline |
|---|---:|---:|---|---:|---:|---|---|
| hoppscotch-backend | 2362 | 2 | 0.085% | 46234 | 3 | 0.006% | yes |
| immich-server | 4546 | 0 | 0.00% | 45824 | 4 | 0.009% | no |
| podkrepi-api | 185 | 0 | 0.00% | 40875 | 3 | 0.007% | no |
| hedgedoc-backend | 7626 | 0 | 0.00% | 27883 | 0 | 0.00% | tie |
| awesome-nest-boilerplate | 3724 | 4 | 0.11% | 11147 | 5 | 0.045% | yes |
| mikro-orm-realworld | 1598 | 0 | 0.00% | 7806 | 0 | 0.00% | tie |
| clean-ts-api | 286 | 0 | 0.00% | 19057 | 7 | 0.037% | no |
| standardnotes-auth | 43319 | 0 | 0.00% | 68171 | 4 | 0.006% | no |
| domain-driven-hexagon | 1719 | 1 | 0.058% | 6428 | 4 | 0.062% | no |
| bitloops-ddd-backend | 1010 | 0 | 0.00% | 2169 | 0 | 0.00% | tie |
| medplum-server | 11963 | 0 | 0.00% | 20045 | 3 | 0.015% | no |
| reactive-resume-api | 6893 | 0 | 0.00% | 1378 | 0 | 0.00% | tie |
| etherpad | 4676 | 0 | 0.00% | 3982 | 0 | 0.00% | tie |
| pvarentsov-clean | 2497 | 0 | 0.00% | 49542 | 11 | 0.022% | no |
| luizomf-clean-api | 537 | 1 | 0.19% | 13755 | 5 | 0.036% | yes |
| w3tec-express-boilerplate | 447 | 0 | 0.00% | 505 | 0 | 0.00% | tie |
| talento90-typescript-node | 44 | 0 | 0.00% | 198 | 0 | 0.00% | tie |
| zeldaplay-api | 16 | 0 | 0.00% | 1752 | 2 | 0.11% | no |
| neoteric-nestjs-auth | 182 | 0 | 0.00% | 780 | 0 | 0.00% | tie |
| vivify-nestjs-boilerplate | 133 | 2 | 1.50% | 564 | 1 | 0.18% | yes |
| nest-products-hexagonal | 42 | 0 | 0.00% | 554 | 0 | 0.00% | tie |
| ddd-forum | 6236 | 6 | 0.096% | 30277 | 4 | 0.013% | yes |
| finance-project-ddd | 1354 | 0 | 0.00% | 7240 | 4 | 0.055% | no |
| event-sourcing-ddd | 58 | 0 | 0.00% | 290 | 9 | 3.10% | no |
| ghostfolio-api | 17554 | 0 | 0.00% | 59958 | 6 | 0.010% | no |
| directus-api | 6453 | 0 | 0.00% | 19789 | 1 | 0.005% | no |
| outline-server | 15817 | 0 | 0.00% | 95934 | 3 | 0.003% | no |
| logto-core | 8756 | 8 | 0.091% | 9226 | 9 | 0.098% | no |
| unleash | 8335 | 0 | 0.00% | 29052 | 9 | 0.031% | no |
| budibase-server | 13724 | 0 | 0.00% | 19647 | 0 | 0.00% | tie |
| amplication-server | 6067 | 50 | 0.82% | 60055 | 12 | 0.020% | yes |

Sign test: 6 of 21 non-tied repositories have a higher blocking rate than their cross-layer baseline; two-sided p = 0.0784.

## Per rule

Pair level (exposures, FIXED-BY-DEV among edge-shaped exposures, Wilson 95%), and grid level (lineages born after the first sampled commit: Kaplan-Meier median survival in days, share of endings with every named file still in place). Rate ratio against the unflagged cross-layer baseline.

| rule | tier | exposures (edge-shaped) | FIXED-BY-DEV | rate [Wilson 95%] | RR vs baseline [95%] | introduced | other causes | lineages (ended) | KM median days | ended in place | fix commits with arch words |
|---|---|---:|---:|---|---|---:|---|---:|---:|---|---|
| FF-DS02 | blocking | 1890 (1890) | 0 | 0.00% [0.00%, 0.20%] | 1.68 [0.10, 27.00] | 32 | renamed 1 | 34 (1) | > obs. | 0.00% | 0 / 0 |
| FF-DT01 | blocking | 1327 (1327) | 2 | 0.15% [0.041%, 0.55%] | 9.61 [2.38, 38.87] | 23 | — | 25 (2) | > obs. | 100.00% | 0 / 1 |
| FF-DT02 | blocking | 453 (453) | 2 | 0.44% [0.12%, 1.60%] | 28.15 [6.97, 113.63] | 8 | — | 8 (2) | > obs. | 100.00% | 0 / 1 |
| FF-DT03 | blocking | 1 (0) | 0 | file-level | — | 1 | file-deleted 1 | 1 (1) | 14 | 0.00% | 0 / 0 |
| FF-DT04 | blocking | 398 (0) | 0 | file-level | — | 8 | renamed 3 | 17 (4) | > obs. | 0.00% | 0 / 0 |
| FF-P01 | blocking | 23239 (0) | 0 | file-level | — | 47 | resolved-in-place 6, file-deleted 15, renamed 4 | 280 (108) | > obs. | 52.78% | 0 / 0 |
| FF-P03 | blocking | 6252 (0) | 0 | file-level | — | 7 | file-deleted 2, resolved-in-place 1 | 74 (15) | 1296 | 13.33% | 0 / 0 |
| FF-S01 | blocking | 78528 (78528) | 8 | 0.010% [0.005%, 0.020%] | 0.65 [0.32, 1.33] | 309 | file-deleted 37, renamed 25, mass-or-bot 10 | 1005 (300) | > obs. | 37.00% | 3 / 6 |
| FF-S02 | blocking | 25732 (25732) | 59 | 0.23% [0.18%, 0.30%] | 14.62 [10.66, 20.05] | 230 | renamed 14, other 7, file-deleted 29, mass-or-bot 9 | 333 (220) | 150 | 50.45% | 1 / 6 |
| FF-S03 (blocking) | blocking | 49817 (49817) | 3 | 0.006% [0.002%, 0.018%] | 0.38 [0.12, 1.21] | 106 | file-deleted 14, renamed 1 | 912 (323) | > obs. | 50.46% | 2 / 2 |
| FF-S04 | blocking | 20412 (20412) | 0 | 0.00% [0.00%, 0.019%] | 0.16 [0.01, 2.50] | 31 | file-deleted 8, renamed 4 | 96 (26) | > obs. | 3.85% | 0 / 0 |
| FF-C01 | advisory | 14648 (0) | 0 | file-level | — | 9 | file-deleted 4, renamed 2, mass-or-bot 1 | 39 (14) | > obs. | 21.43% | 0 / 0 |
| FF-C02 | advisory | 39826 (0) | 0 | file-level | — | 93 | resolved-in-place 11, renamed 20, file-deleted 5, mass-or-bot 2 | 656 (249) | > obs. | 66.27% | 0 / 0 |
| FF-C03 | advisory | 138743 (0) | 0 | file-level | — | 575 | resolved-in-place 106, renamed 57, file-deleted 66, mass-or-bot 35 | 2513 (1023) | 1424 | 59.73% | 0 / 0 |
| FF-C04 | advisory | 20014 (0) | 0 | file-level | — | 82 | mass-or-bot 13, file-deleted 12, resolved-in-place 13, renamed 1 | 367 (105) | > obs. | 77.14% | 0 / 0 |
| FF-C05 | advisory | 26338 (0) | 0 | file-level | — | 41 | resolved-in-place 6, file-deleted 3, renamed 4, mass-or-bot 1 | 354 (114) | > obs. | 58.77% | 0 / 0 |
| FF-C06 | advisory | 2542 (0) | 0 | file-level | — | 8 | file-deleted 10 | 20 (12) | 149 | 0.00% | 0 / 0 |
| FF-CV02 | advisory | 1034 (0) | 0 | file-level | — | 4 | — | 25 (7) | > obs. | 0.00% | 0 / 0 |
| FF-CV03 | advisory | 2800 (0) | 0 | file-level | — | 18 | file-deleted 3 | 77 (44) | 386 | 4.55% | 0 / 0 |
| FF-CV05 | advisory | 518527 (0) | 0 | file-level | — | 1560 | file-deleted 239, renamed 277, mass-or-bot 1 | 6124 (1270) | > obs. | 0.79% | 0 / 0 |
| FF-CV06 | advisory | 12962 (0) | 0 | file-level | — | 34 | renamed 6, file-deleted 4, resolved-in-place 4 | 191 (50) | > obs. | 28.00% | 0 / 0 |
| FF-P02 | advisory | 23761 (0) | 0 | file-level | — | 99 | renamed 9, resolved-in-place 4, mass-or-bot 3, file-deleted 8 | 273 (70) | > obs. | 35.71% | 0 / 0 |
| FF-P04 | advisory | 14641 (0) | 0 | file-level | — | 47 | resolved-in-place 2, renamed 4, file-deleted 1 | 165 (27) | > obs. | 40.74% | 0 / 0 |
| FF-S03 (advisory) | advisory | 831 (831) | 1 | 0.12% [0.021%, 0.68%] | 7.67 [1.07, 54.89] | 37 | file-deleted 7, mass-or-bot 3, renamed 1 | 35 (13) | > obs. | 38.46% | 1 / 1 |
| FF-SO01 | advisory | 34227 (0) | 0 | file-level | — | 88 | resolved-in-place 9, renamed 14, file-deleted 6, mass-or-bot 2 | 501 (180) | > obs. | 44.44% | 0 / 0 |
| FF-SO02 | advisory | 9126 (0) | 0 | file-level | — | 10 | resolved-in-place 2, file-deleted 1, renamed 1 | 130 (85) | 291 | 14.12% | 0 / 0 |
| FF-SO03 | advisory | 78 (0) | 0 | file-level | — | 0 | — | 1 (0) | > obs. | n/a | 0 / 0 |

## Survival (grid level)

| group | lineages | ended | KM median days | S(365 d) | ended with files in place |
|---|---:|---:|---:|---:|---|
| blocking, edge-shaped findings | 2413 | 874 | 1561 | 0.709 | 44.62% |
| blocking, edge-shaped, without FF-S02 cycles | 2080 | 654 | > obs. | 0.760 | 42.66% |
| blocking FF-S02 cycles only | 333 | 220 | 150 | 0.373 | 50.45% |
| advisory, edge-shaped findings | 35 | 13 | > obs. | 0.873 | 38.46% |
| advisory, file-level findings | 11436 | 3250 | > obs. | 0.774 | 33.26% |
| unflagged cross-layer import edges | 11211 | 3790 | > obs. | 0.746 | 31.58% |
| unflagged same-layer import edges | 18306 | 6073 | > obs. | 0.754 | 37.81% |
| unflagged import edges, unlayered file | 28639 | 16943 | 339 | 0.490 | 27.96% |

## Sensitivity (post hoc)

Not in protocol.md: added after the pooled ratio turned out to rest on few commits. Baseline: unflagged cross-layer import edges (for the per-commit row, distinct commits that removed at least one such edge).

| variant | credited | exposures | rate [Wilson 95%] | RR vs baseline [95%] |
|---|---:|---:|---|---|
| primary: all blocking edge-shaped | 74 | 178159 | 0.042% [0.033%, 0.052%] | 2.65 [1.97, 3.56] |
| without FF-S02 (cycles) | 15 | 152427 | 0.010% [0.006%, 0.016%] | 0.63 [0.37, 1.08] |
| FF-S02 only | 59 | 25732 | 0.23% [0.18%, 0.30%] | 14.62 [10.66, 20.05] |
| without the largest fix commit (amplication-server ce020af2ef3d466e5a2a6, 48 findings) | 26 | 178159 | 0.015% [0.010%, 0.021%] | 0.93 [0.61, 1.43] |
| FF-S02 without the largest fix commit | 11 | 25732 | 0.043% [0.024%, 0.077%] | 2.73 [1.47, 5.07] |
| one credit per fix commit (distinct commits / exposures) | 14 | 178159 | 0.008% [0.005%, 0.013%] | 1.00 [0.56, 1.80] |

Leave one repository out: RR from 0.91 (without amplication-server) to 3.28 (without standardnotes-auth).

Cycle length: exposure-weighted mean cycle length 3.77 files (median lineage 9). If each edge went at the per-edge baseline rate p, a cycle would be credited at about 1-(1-p)^L: 0.059% (cross-layer p) or 0.047% (all unflagged p), against the observed 0.23%; length-adjusted ratio 3.88 and 4.87.

## Example fix commits (blocking tier, FIXED-BY-DEV)

14 distinct commits in the pool; 14 shown, round-robin over repositories.

| # | repository | commit | date | rule | finding (file -> target) | commit message | arch words |
|---:|---|---|---|---|---|---|---|
| 1 | hoppscotch/hoppscotch | [a6147f4ce4](https://github.com/hoppscotch/hoppscotch/commit/a6147f4ce4b75c49760daf7448b713cbf33b12fd) | 2025-02-28 | FF-S01 | `src/auth/strategies/jwt.strategy.ts` -> `src/auth/auth.service.ts` | feat: platform independent core and the new desktop app (#4684) | yes |
| 2 | NarHakobyan/awesome-nest-boilerplate | [c61bafd11c](https://github.com/NarHakobyan/awesome-nest-boilerplate/commit/c61bafd11ce7d67fcb32490160a7f871e8de4d30) | 2021-12-21 | FF-S02 | `src/decorators/field.decorators.ts` -> `cycle 6 files` | chore(): move util function to separate file without wrapping it under provider | no |
| 3 | Sairyss/domain-driven-hexagon | [92515cfa73](https://github.com/Sairyss/domain-driven-hexagon/commit/92515cfa731dc8706ea7eb67967d309483b38167) | 2022-10-11 | FF-S01 | `src/modules/user/queries/find-users/find-users.query-handler.ts` -> `src/modules/user/database/user.repository.port.ts` | refactor: query handlers now don't use repositories and retrieve models directly | yes |
| 4 | luizomf/clean-architecture-api-boilerplate | [c8d0a6f173](https://github.com/luizomf/clean-architecture-api-boilerplate/commit/c8d0a6f173c0bd7748ef14cb7588274dc3a106b8) | 2020-11-28 | FF-S01 | `src/application/use-cases/sign-in/sign-in.ts` -> `src/infrastructure/repositories/user/user-default-repository.ts` | test: sign in use case | no |
| 5 | Vivify-Ideas/nestjs-boilerplate | [5d37625f9f](https://github.com/Vivify-Ideas/nestjs-boilerplate/commit/5d37625f9fce8427e9e4f671e39dcefde837b165) | 2019-06-19 | FF-S02 | `src/modules/auth/auth.module.ts` -> `cycle 3 files` | Improved swagger docs with additional scheme, posibility to generate unexpiring jwt token | no |
| 6 | stemmlerjs/ddd-forum | [dd6e413c47](https://github.com/stemmlerjs/ddd-forum/commit/dd6e413c47063a6dec0a098521822036d08ee189) | 2019-10-15 | FF-DT01 | `src/modules/forum/repos/implementations/sequelizePostRepo.ts` -> `src/modules/forum/domain/comment.ts` | Remove unnecessary imports. | no |
| 7 | logto-io/logto | [1f293292b8](https://github.com/logto-io/logto/commit/1f293292b8a228896d214370ff884eb117e4a68c) | 2023-01-10 | FF-S03 | `src/middleware/koa-audit-log.ts` -> `src/queries/log.ts` | Merge pull request #2891 from logto-io/gao-log-5124-core-library-factory-hook — refactor(core): migrate hook library to factory mode | yes |
| 8 | amplication/amplication | [eaf9eae7d6](https://github.com/amplication/amplication/commit/eaf9eae7d60722cd75ecf0315f97a5f09632e814) | 2020-05-17 | FF-S02 | `src/dto/inputs/AppCreateInput.ts` -> `cycle 2 files` | Merge pull request #14 from amplication/feature/apps-view — Apps View | no |
| 9 | hoppscotch/hoppscotch | [0b7d31a20c](https://github.com/hoppscotch/hoppscotch/commit/0b7d31a20cef7b927cb8741063986ba2b66d5487) | 2025-07-28 | FF-S02 | `src/auth/helper.ts` -> `cycle 2 files` | feature: reduce `.env` usage and move configurations to admin dashboard (#5194) | no |
| 10 | stemmlerjs/ddd-forum | [d2ae510a04](https://github.com/stemmlerjs/ddd-forum/commit/d2ae510a04348cce4a598158b9d847bc6075fccd) | 2019-10-09 | FF-S01 | `src/modules/forum/domain/services/postService.ts` -> `src/modules/forum/useCases/post/downvotePost/DownvotePostErrors.ts` | Got upvotes and downvotes aggregate logic working by using the WatchedList<T> class. | no |
| 11 | logto-io/logto | [080632a744](https://github.com/logto-io/logto/commit/080632a74402f81429d58bf23ffe2a2fac7d6301) | 2024-07-22 | FF-S02 | `src/routes/experience/classes/utils.ts` -> `cycle 3 files` | refactor(core): extract helpers and provision methods (#6285) | yes |
| 12 | amplication/amplication | [ce020af2ef](https://github.com/amplication/amplication/commit/ce020af2ef3d466e5a2a60d0ee4cb0d9e1fc66ba) | 2020-06-16 | FF-S02 | `src/core/app/dto/AppFilter.ts` -> `cycle 2 files` | Merge pull request #93 from amplication/lint/imports — Lint Imports | no |
| 13 | logto-io/logto | [8a1abc924a](https://github.com/logto-io/logto/commit/8a1abc924a7e14f7ef4f7304aab2e149cc6d84f1) | 2026-07-14 | FF-S01 | `src/event-listeners/authorization-success.ts` -> `src/middleware/koa-app-secret-transpilation.ts` | refactor(core): align OIDC event listener context types with emitted events (#9204) | yes |
| 14 | amplication/amplication | [ea396ef123](https://github.com/amplication/amplication/commit/ea396ef12336cdecb0e16cd787e25f274a4177ca) | 2020-08-30 | FF-S01 | `src/core/auth/jwt.strategy.ts` -> `src/core/user/user.service.ts` | Merge pull request #262 from amplication/feature/github-login — Add GitHub passport strategy | no |

