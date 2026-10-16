# v1.3 SO5 spec ladder: generated tables

Projects: 35; complete at all five levels: 34; missing: bank-server (L1, L2, L3, L4, L5).
L5 reproduces the committed full-spec blocking count on 34/34 projects.

## Per level (complete projects)

| level | fail | blocking | mapped file share | verdict κ vs L5 | agreement vs L5 | pass here, fail at L5 | fail here, pass at L5 |
|---|---:|---:|---:|---:|---:|---:|---:|
| L1 | 22/34 | 860 | 0.25 | 0.33 | 0.74 | 8 | 1 |
| L2 | 28/34 | 1047 | 0.71 | 0.68 | 0.91 | 2 | 1 |
| L3 | 30/34 | 1085 | 0.78 | 0.87 | 0.97 | 0 | 1 |
| L4 | 30/34 | 1085 | 0.78 | 0.87 | 0.97 | 0 | 1 |
| L5 | 29/34 | 460 | 0.78 | 1.00 | 1.00 | 0 | 0 |

## Blocking findings by rule and level

| rule | L1 | L2 | L3 | L4 | L5 |
|---|---:|---:|---:|---:|---:|
| FF-DS01 | 695 | 695 | 695 | 695 | 2 |
| FF-DS02 | 0 | 0 | 0 | 0 | 39 |
| FF-DT01 | 0 | 0 | 0 | 0 | 23 |
| FF-DT02 | 0 | 0 | 0 | 0 | 6 |
| FF-DT04 | 6 | 24 | 24 | 24 | 24 |
| FF-P01 | 1 | 22 | 22 | 22 | 22 |
| FF-P03 | 2 | 10 | 10 | 10 | 10 |
| FF-S01 | 48 | 152 | 190 | 190 | 190 |
| FF-S02 | 108 | 108 | 108 | 108 | 108 |
| FF-S03 | 0 | 34 | 34 | 34 | 34 |
| FF-S04 | 0 | 2 | 2 | 2 | 2 |

## Projects where each rule fires (κ of the per-project "fires" indicator vs L5)

| rule | L1 | L2 | L3 | L4 | L5 |
|---|---|---|---|---|---|
| FF-DS01 | 7 (κ 0.21) | 7 (κ 0.21) | 7 (κ 0.21) | 7 (κ 0.21) | 1 (κ 1.00) |
| FF-DS02 | 0 (κ 0.00) | 0 (κ 0.00) | 0 (κ 0.00) | 0 (κ 0.00) | 4 (κ 1.00) |
| FF-DT01 | 0 (κ 0.00) | 0 (κ 0.00) | 0 (κ 0.00) | 0 (κ 0.00) | 2 (κ 1.00) |
| FF-DT02 | 0 (κ 0.00) | 0 (κ 0.00) | 0 (κ 0.00) | 0 (κ 0.00) | 1 (κ 1.00) |
| FF-DT04 | 1 (κ 0.48) | 3 (κ 1.00) | 3 (κ 1.00) | 3 (κ 1.00) | 3 (κ 1.00) |
| FF-P01 | 1 (κ 0.21) | 7 (κ 1.00) | 7 (κ 1.00) | 7 (κ 1.00) | 7 (κ 1.00) |
| FF-P03 | 1 (κ 0.37) | 4 (κ 1.00) | 4 (κ 1.00) | 4 (κ 1.00) | 4 (κ 1.00) |
| FF-S01 | 3 (κ 0.13) | 16 (κ 0.77) | 20 (κ 1.00) | 20 (κ 1.00) | 20 (κ 1.00) |
| FF-S02 | 13 (κ 1.00) | 13 (κ 1.00) | 13 (κ 1.00) | 13 (κ 1.00) | 13 (κ 1.00) |
| FF-S03 | 0 (κ 0.00) | 6 (κ 1.00) | 6 (κ 1.00) | 6 (κ 1.00) | 6 (κ 1.00) |
| FF-S04 | 0 (κ 0.00) | 2 (κ 1.00) | 2 (κ 1.00) | 2 (κ 1.00) | 2 (κ 1.00) |

## Rule switch-on (first level with a blocking finding, per project)

| rule | projects ever on | first on L1 | first on L2 | first on L3 | first on L4 | first on L5 | on at L5 | on below L5, off at L5 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| FF-DS01 | 7 | 7 | 0 | 0 | 0 | 0 | 1 | 6 |
| FF-DS02 | 4 | 0 | 0 | 0 | 0 | 4 | 4 | 0 |
| FF-DT01 | 2 | 0 | 0 | 0 | 0 | 2 | 2 | 0 |
| FF-DT02 | 1 | 0 | 0 | 0 | 0 | 1 | 1 | 0 |
| FF-DT04 | 3 | 1 | 2 | 0 | 0 | 0 | 3 | 0 |
| FF-P01 | 7 | 1 | 6 | 0 | 0 | 0 | 7 | 0 |
| FF-P03 | 4 | 1 | 3 | 0 | 0 | 0 | 4 | 0 |
| FF-S01 | 20 | 3 | 14 | 3 | 0 | 0 | 20 | 0 |
| FF-S02 | 13 | 13 | 0 | 0 | 0 | 0 | 13 | 0 |
| FF-S03 | 6 | 0 | 6 | 0 | 0 | 0 | 6 | 0 |
| FF-S04 | 2 | 0 | 2 | 0 | 0 | 0 | 2 | 0 |

## Monotonicity over L1→L5

Blocking count: {"constant":5,"non-decreasing":21,"non-increasing":3,"neither":5}. Verdict (fail = 1): {"constant":24,"non-decreasing":8,"non-increasing":1,"neither":1}.

## Per project

| project | style | blocking L1/L2/L3/L4/L5 | verdict L1/L2/L3/L4/L5 | mapped L1/L2/L3/L4/L5 | blocking trend |
|---|---|---|---|---|---|
| bulletproof-nodejs | layered | 0 / 0 / 0 / 0 / 0 | pass / pass / pass / pass / pass | 0 / 12 / 12 / 12 / 12 | constant |
| conduit-ports-adapters | hexagonal | 0 / 1 / 1 / 1 / 1 | pass / fail / fail / fail / fail | 2 / 35 / 35 / 35 / 35 | non-decreasing |
| dannielhugo-clean | clean-architecture | 0 / 0 / 0 / 0 / 0 | pass / pass / pass / pass / pass | 0 / 49 / 68 / 68 / 68 | constant |
| ddd-forum | ddd | 250 / 290 / 290 / 290 / 92 | fail / fail / fail / fail / fail | 10 / 248 / 248 / 248 / 248 | neither |
| ddialar-hexagonal-boilerplate | hexagonal | 0 / 0 / 0 / 0 / 0 | pass / pass / pass / pass / pass | 0 / 17 / 17 / 17 / 17 | constant |
| event-sourcing-ddd | ddd | 58 / 78 / 78 / 78 / 20 | fail / fail / fail / fail / fail | 0 / 58 / 58 / 58 / 58 | neither |
| finance-project-ddd | ddd | 177 / 217 / 217 / 217 / 50 | fail / fail / fail / fail / fail | 1 / 156 / 156 / 156 / 156 | neither |
| luizomf-clean-api | clean-architecture | 0 / 0 / 9 / 9 / 9 | pass / pass / fail / fail / fail | 93 / 93 / 115 / 115 / 115 | non-decreasing |
| neoteric-nestjs-auth | nestjs | 56 / 72 / 72 / 72 / 72 | fail / fail / fail / fail / fail | 67 / 155 / 155 / 155 / 155 | non-decreasing |
| nest-products-hexagonal | hexagonal | 1 / 3 / 3 / 3 / 3 | fail / fail / fail / fail / fail | 12 / 23 / 23 / 23 / 23 | non-decreasing |
| pvarentsov-clean | clean-architecture | 37 / 0 / 18 / 18 / 18 | fail / pass / fail / fail / fail | 82 / 140 / 184 / 184 / 184 | neither |
| talento90-typescript-node | layered | 0 / 4 / 4 / 4 / 4 | pass / fail / fail / fail / fail | 0 / 29 / 29 / 29 / 29 | non-decreasing |
| vivify-nestjs-boilerplate | nestjs | 2 / 6 / 6 / 6 / 6 | fail / fail / fail / fail / fail | 11 / 27 / 27 / 27 / 27 | non-decreasing |
| w3tec-express-boilerplate | layered | 3 / 8 / 8 / 8 / 8 | fail / fail / fail / fail / fail | 0 / 29 / 29 / 29 / 29 | non-decreasing |
| zeldaplay-api | nestjs | 0 / 0 / 0 / 0 / 0 | pass / pass / pass / pass / pass | 41 / 79 / 79 / 79 / 79 | constant |
| adilsonfuxe-auth | clean-architecture | 1 / 1 / 1 / 1 / 1 | fail / fail / fail / fail / fail | 12 / 67 / 133 / 133 / 133 | constant |
| camps-graphql-api | ddd | 45 / 45 / 45 / 45 / 0 | fail / fail / fail / fail / pass | 6 / 45 / 45 / 45 / 45 | non-increasing |
| felixle-node-core | clean-architecture | 2 / 3 / 7 / 7 / 7 | fail / fail / fail / fail / fail | 91 / 152 / 181 / 181 / 181 | non-decreasing |
| geekyants-express | layered | 0 / 6 / 6 / 6 / 6 | pass / fail / fail / fail / fail | 0 / 24 / 24 / 24 / 24 | non-decreasing |
| hexapinod | hexagonal | 1 / 3 / 3 / 3 / 3 | fail / fail / fail / fail / fail | 12 / 38 / 38 / 38 / 38 | non-decreasing |
| jamielivingstone-clean | clean-architecture | 11 / 11 / 15 / 15 / 15 | fail / fail / fail / fail / fail | 28 / 28 / 38 / 38 / 38 | non-decreasing |
| monstarlab-nestjs-starter | nestjs | 8 / 12 / 12 / 12 / 12 | fail / fail / fail / fail / fail | 42 / 52 / 52 / 52 / 52 | non-decreasing |
| mustodon | ddd | 71 / 71 / 71 / 71 / 6 | fail / fail / fail / fail / fail | 66 / 73 / 73 / 73 / 73 | non-increasing |
| ngduc-node-rem | layered | 0 / 5 / 5 / 5 / 5 | pass / fail / fail / fail / fail | 0 / 17 / 17 / 17 / 17 | non-decreasing |
| nutes-template-base | clean-architecture | 3 / 3 / 6 / 6 / 6 | fail / fail / fail / fail / fail | 25 / 25 / 32 / 32 / 32 | non-decreasing |
| pezzetti-base-app | ddd | 27 / 32 / 32 / 32 / 10 | fail / fail / fail / fail / fail | 1 / 28 / 28 / 28 / 28 | neither |
| quiz4devs-backend | hexagonal | 6 / 10 / 10 / 10 / 10 | fail / fail / fail / fail / fail | 0 / 21 / 21 / 21 / 21 | non-decreasing |
| remix-hexagonal | hexagonal | 2 / 30 / 30 / 30 / 30 | fail / fail / fail / fail / fail | 0 / 115 / 115 / 115 / 115 | non-decreasing |
| saluki-nestjs-template | nestjs | 1 / 2 / 2 / 2 / 2 | fail / fail / fail / fail / fail | 10 / 25 / 25 / 25 / 25 | non-decreasing |
| shihabmridha-repo-ioc | layered | 0 / 1 / 1 / 1 / 1 | pass / fail / fail / fail / fail | 0 / 6 / 6 / 6 / 6 | non-decreasing |
| staart-api | nestjs | 0 / 4 / 4 / 4 / 4 | pass / fail / fail / fail / fail | 97 / 116 / 116 / 116 / 116 | non-decreasing |
| talyssonoc-node-api | ddd | 73 / 73 / 73 / 73 / 3 | fail / fail / fail / fail / fail | 17 / 39 / 39 / 39 / 39 | non-increasing |
| ts-seed-hexagonal | hexagonal | 0 / 5 / 5 / 5 / 5 | pass / fail / fail / fail / fail | 0 / 22 / 22 / 22 / 22 | non-decreasing |
| typeplate | layered | 25 / 51 / 51 / 51 / 51 | fail / fail / fail / fail / fail | 0 / 34 / 34 / 34 / 34 | non-decreasing |
