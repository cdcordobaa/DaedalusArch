# External set, deterministic correctness: summary

Pass criterion (every one of 211 blocking findings labelled with evidence): **met** (211 labelled of 211 checked).

## Blocking findings

| pooled | n | correct | incorrect | not-checkable | precision | Wilson 95% | not-checkable share |
|---|---:|---:|---:|---:|---:|---|---:|
| all blocking | 211 | 211 | 0 | 0 | 1.000 | [0.982, 1.000] | 0.000 |

| style | n | correct | incorrect | not-checkable | precision | Wilson 95% | not-checkable share |
|---|---:|---:|---:|---:|---:|---|---:|
| clean-architecture | 20 | 20 | 0 | 0 | 1.000 | [0.839, 1.000] | 0.000 |
| ddd | 71 | 71 | 0 | 0 | 1.000 | [0.949, 1.000] | 0.000 |
| hexagonal | 28 | 28 | 0 | 0 | 1.000 | [0.879, 1.000] | 0.000 |
| layered | 61 | 61 | 0 | 0 | 1.000 | [0.941, 1.000] | 0.000 |
| nestjs | 31 | 31 | 0 | 0 | 1.000 | [0.890, 1.000] | 0.000 |

| style rule/template | n | correct | incorrect | not-checkable | precision | Wilson 95% | not-checkable share |
|---|---:|---:|---:|---:|---:|---|---:|
| clean-architecture FF-P03/repository-pattern | 3 | 3 | 0 | 0 | 1.000 | [0.439, 1.000] | 0.000 |
| clean-architecture FF-S01/dependency-direction | 12 | 12 | 0 | 0 | 1.000 | [0.758, 1.000] | 0.000 |
| clean-architecture FF-S02/no-cyclic-deps | 5 | 5 | 0 | 0 | 1.000 | [0.566, 1.000] | 0.000 |
| ddd FF-DS02/context-isolation | 35 | 35 | 0 | 0 | 1.000 | [0.901, 1.000] | 0.000 |
| ddd FF-DT01/aggregate-boundary | 2 | 2 | 0 | 0 | 1.000 | [0.342, 1.000] | 0.000 |
| ddd FF-DT04/domain-purity | 3 | 3 | 0 | 0 | 1.000 | [0.439, 1.000] | 0.000 |
| ddd FF-S01/dependency-direction-graph | 31 | 31 | 0 | 0 | 1.000 | [0.890, 1.000] | 0.000 |
| hexagonal FF-P03/port-adapter-pattern | 4 | 4 | 0 | 0 | 1.000 | [0.510, 1.000] | 0.000 |
| hexagonal FF-S01/dependency-direction-graph | 10 | 10 | 0 | 0 | 1.000 | [0.722, 1.000] | 0.000 |
| hexagonal FF-S02/no-cyclic-deps | 7 | 7 | 0 | 0 | 1.000 | [0.646, 1.000] | 0.000 |
| hexagonal FF-S04/core-isolation | 7 | 7 | 0 | 0 | 1.000 | [0.646, 1.000] | 0.000 |
| layered FF-P01/domain-purity | 8 | 8 | 0 | 0 | 1.000 | [0.676, 1.000] | 0.000 |
| layered FF-S01/dependency-direction | 11 | 11 | 0 | 0 | 1.000 | [0.741, 1.000] | 0.000 |
| layered FF-S02/no-cyclic-deps | 15 | 15 | 0 | 0 | 1.000 | [0.796, 1.000] | 0.000 |
| layered FF-S03/no-layer-skip | 27 | 27 | 0 | 0 | 1.000 | [0.875, 1.000] | 0.000 |
| nestjs FF-P01/domain-purity | 8 | 8 | 0 | 0 | 1.000 | [0.676, 1.000] | 0.000 |
| nestjs FF-S01/dependency-direction | 12 | 12 | 0 | 0 | 1.000 | [0.758, 1.000] | 0.000 |
| nestjs FF-S02/no-cyclic-deps | 11 | 11 | 0 | 0 | 1.000 | [0.741, 1.000] | 0.000 |

| template | n | correct | incorrect | not-checkable | precision | Wilson 95% | not-checkable share |
|---|---:|---:|---:|---:|---:|---|---:|
| aggregate-boundary | 2 | 2 | 0 | 0 | 1.000 | [0.342, 1.000] | 0.000 |
| context-isolation | 35 | 35 | 0 | 0 | 1.000 | [0.901, 1.000] | 0.000 |
| core-isolation | 7 | 7 | 0 | 0 | 1.000 | [0.646, 1.000] | 0.000 |
| dependency-direction | 35 | 35 | 0 | 0 | 1.000 | [0.901, 1.000] | 0.000 |
| dependency-direction-graph | 41 | 41 | 0 | 0 | 1.000 | [0.914, 1.000] | 0.000 |
| domain-purity | 19 | 19 | 0 | 0 | 1.000 | [0.832, 1.000] | 0.000 |
| no-cyclic-deps | 38 | 38 | 0 | 0 | 1.000 | [0.908, 1.000] | 0.000 |
| no-layer-skip | 27 | 27 | 0 | 0 | 1.000 | [0.875, 1.000] | 0.000 |
| port-adapter-pattern | 4 | 4 | 0 | 0 | 1.000 | [0.510, 1.000] | 0.000 |
| repository-pattern | 3 | 3 | 0 | 0 | 1.000 | [0.439, 1.000] | 0.000 |

| style project | n | correct | incorrect | not-checkable | precision | Wilson 95% | not-checkable share |
|---|---:|---:|---:|---:|---:|---|---:|
| clean-architecture cartaxo-ts-boilerplate | 6 | 6 | 0 | 0 | 1.000 | [0.610, 1.000] | 0.000 |
| clean-architecture cersouza-boilerplate | 1 | 1 | 0 | 0 | 1.000 | [0.207, 1.000] | 0.000 |
| clean-architecture devnica-clean-backend | 4 | 4 | 0 | 0 | 1.000 | [0.510, 1.000] | 0.000 |
| clean-architecture leal32b-webapi | 9 | 9 | 0 | 0 | 1.000 | [0.701, 1.000] | 0.000 |
| ddd ddd-libellis | 2 | 2 | 0 | 0 | 1.000 | [0.342, 1.000] | 0.000 |
| ddd dlydiard-ddd-cqrs-es | 14 | 14 | 0 | 0 | 1.000 | [0.785, 1.000] | 0.000 |
| ddd lucashang-ddd-payday | 13 | 13 | 0 | 0 | 1.000 | [0.772, 1.000] | 0.000 |
| ddd meetinger | 42 | 42 | 0 | 0 | 1.000 | [0.916, 1.000] | 0.000 |
| hexagonal canario-hexagonal-express | 6 | 6 | 0 | 0 | 1.000 | [0.610, 1.000] | 0.000 |
| hexagonal hexagonal-banking | 14 | 14 | 0 | 0 | 1.000 | [0.785, 1.000] | 0.000 |
| hexagonal nalhin-movies | 6 | 6 | 0 | 0 | 1.000 | [0.610, 1.000] | 0.000 |
| hexagonal twiddlle-nest-hexagonal | 2 | 2 | 0 | 0 | 1.000 | [0.342, 1.000] | 0.000 |
| layered bymi15-express-typeorm | 9 | 9 | 0 | 0 | 1.000 | [0.701, 1.000] | 0.000 |
| layered firmanjs-express-template | 3 | 3 | 0 | 0 | 1.000 | [0.439, 1.000] | 0.000 |
| layered pallavi-twitter-backend | 24 | 24 | 0 | 0 | 1.000 | [0.862, 1.000] | 0.000 |
| layered q00-api-server | 25 | 25 | 0 | 0 | 1.000 | [0.867, 1.000] | 0.000 |
| nestjs innei-nest-http | 4 | 4 | 0 | 0 | 1.000 | [0.510, 1.000] | 0.000 |
| nestjs neosoft-rest-nestjs | 6 | 6 | 0 | 0 | 1.000 | [0.610, 1.000] | 0.000 |
| nestjs ruslanguns-nestjs-starter | 19 | 19 | 0 | 0 | 1.000 | [0.832, 1.000] | 0.000 |
| nestjs surgeharb-nestjs | 1 | 1 | 0 | 0 | 1.000 | [0.207, 1.000] | 0.000 |
| nestjs tannergabriel-nest-graphql | 1 | 1 | 0 | 0 | 1.000 | [0.207, 1.000] | 0.000 |

## Incorrect blocking findings

None.

## Not-checkable blocking findings

None.

## Advisory sample (secondary)

| pooled | n | correct | incorrect | not-checkable | precision | Wilson 95% | not-checkable share |
|---|---:|---:|---:|---:|---:|---|---:|
| advisory sample | 30 | 21 | 0 | 9 | 1.000 | [0.845, 1.000] | 0.300 |

| style rule/template | n | correct | incorrect | not-checkable | precision | Wilson 95% | not-checkable share |
|---|---:|---:|---:|---:|---:|---|---:|
| clean-architecture FF-C03/component-instability | 1 | 0 | 0 | 1 | n/a | n/a | 1.000 |
| clean-architecture FF-C04/no-orphan-files | 2 | 0 | 0 | 2 | n/a | n/a | 1.000 |
| clean-architecture FF-C05/max-fan-in | 1 | 0 | 0 | 1 | n/a | n/a | 1.000 |
| clean-architecture FF-CV05/test-file-pairing | 10 | 10 | 0 | 0 | 1.000 | [0.722, 1.000] | 0.000 |
| clean-architecture FF-P02/dependency-inversion | 1 | 0 | 0 | 1 | n/a | n/a | 1.000 |
| ddd FF-S03/layer-skip-graph | 1 | 1 | 0 | 0 | 1.000 | [0.207, 1.000] | 0.000 |
| hexagonal FF-C03/component-instability | 1 | 0 | 0 | 1 | n/a | n/a | 1.000 |
| hexagonal FF-CV05/test-file-pairing | 3 | 3 | 0 | 0 | 1.000 | [0.439, 1.000] | 0.000 |
| layered FF-C03/component-instability | 1 | 0 | 0 | 1 | n/a | n/a | 1.000 |
| layered FF-C06/abstraction-ratio | 1 | 0 | 0 | 1 | n/a | n/a | 1.000 |
| layered FF-CV05/test-file-pairing | 4 | 4 | 0 | 0 | 1.000 | [0.510, 1.000] | 0.000 |
| nestjs FF-C04/no-orphan-files | 1 | 0 | 0 | 1 | n/a | n/a | 1.000 |
| nestjs FF-CV05/test-file-pairing | 3 | 3 | 0 | 0 | 1.000 | [0.439, 1.000] | 0.000 |
