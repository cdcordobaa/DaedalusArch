# External set, deterministic correctness: summary

Pass criterion (every one of 283 blocking findings labelled with evidence): **met** (283 labelled of 283 checked).

## Blocking findings

| pooled | n | correct | incorrect | not-checkable | precision | Wilson 95% | not-checkable share |
|---|---:|---:|---:|---:|---:|---|---:|
| all blocking | 283 | 283 | 0 | 0 | 1.000 | [0.987, 1.000] | 0.000 |

| style | n | correct | incorrect | not-checkable | precision | Wilson 95% | not-checkable share |
|---|---:|---:|---:|---:|---:|---|---:|
| clean-architecture | 27 | 27 | 0 | 0 | 1.000 | [0.875, 1.000] | 0.000 |
| ddd | 162 | 162 | 0 | 0 | 1.000 | [0.977, 1.000] | 0.000 |
| hexagonal | 4 | 4 | 0 | 0 | 1.000 | [0.510, 1.000] | 0.000 |
| layered | 12 | 12 | 0 | 0 | 1.000 | [0.758, 1.000] | 0.000 |
| nestjs | 78 | 78 | 0 | 0 | 1.000 | [0.953, 1.000] | 0.000 |

| style rule/template | n | correct | incorrect | not-checkable | precision | Wilson 95% | not-checkable share |
|---|---:|---:|---:|---:|---:|---|---:|
| clean-architecture FF-S01/dependency-direction | 27 | 27 | 0 | 0 | 1.000 | [0.875, 1.000] | 0.000 |
| ddd FF-DS02/context-isolation | 33 | 33 | 0 | 0 | 1.000 | [0.896, 1.000] | 0.000 |
| ddd FF-DT01/aggregate-boundary | 23 | 23 | 0 | 0 | 1.000 | [0.857, 1.000] | 0.000 |
| ddd FF-DT02/repository-aggregate-root | 6 | 6 | 0 | 0 | 1.000 | [0.610, 1.000] | 0.000 |
| ddd FF-DT04/domain-purity | 13 | 13 | 0 | 0 | 1.000 | [0.772, 1.000] | 0.000 |
| ddd FF-S01/dependency-direction-graph | 87 | 87 | 0 | 0 | 1.000 | [0.958, 1.000] | 0.000 |
| hexagonal FF-P01/domain-purity | 1 | 1 | 0 | 0 | 1.000 | [0.207, 1.000] | 0.000 |
| hexagonal FF-S01/dependency-direction-graph | 3 | 3 | 0 | 0 | 1.000 | [0.439, 1.000] | 0.000 |
| layered FF-S01/dependency-direction | 2 | 2 | 0 | 0 | 1.000 | [0.342, 1.000] | 0.000 |
| layered FF-S02/no-cyclic-deps | 3 | 3 | 0 | 0 | 1.000 | [0.439, 1.000] | 0.000 |
| layered FF-S03/no-layer-skip | 7 | 7 | 0 | 0 | 1.000 | [0.646, 1.000] | 0.000 |
| nestjs FF-P01/domain-purity | 14 | 14 | 0 | 0 | 1.000 | [0.785, 1.000] | 0.000 |
| nestjs FF-S01/dependency-direction | 4 | 4 | 0 | 0 | 1.000 | [0.510, 1.000] | 0.000 |
| nestjs FF-S02/no-cyclic-deps | 58 | 58 | 0 | 0 | 1.000 | [0.938, 1.000] | 0.000 |
| nestjs FF-S04/no-domain-outward-dep | 2 | 2 | 0 | 0 | 1.000 | [0.342, 1.000] | 0.000 |

| template | n | correct | incorrect | not-checkable | precision | Wilson 95% | not-checkable share |
|---|---:|---:|---:|---:|---:|---|---:|
| aggregate-boundary | 23 | 23 | 0 | 0 | 1.000 | [0.857, 1.000] | 0.000 |
| context-isolation | 33 | 33 | 0 | 0 | 1.000 | [0.896, 1.000] | 0.000 |
| dependency-direction | 33 | 33 | 0 | 0 | 1.000 | [0.896, 1.000] | 0.000 |
| dependency-direction-graph | 90 | 90 | 0 | 0 | 1.000 | [0.959, 1.000] | 0.000 |
| domain-purity | 28 | 28 | 0 | 0 | 1.000 | [0.879, 1.000] | 0.000 |
| no-cyclic-deps | 61 | 61 | 0 | 0 | 1.000 | [0.941, 1.000] | 0.000 |
| no-domain-outward-dep | 2 | 2 | 0 | 0 | 1.000 | [0.342, 1.000] | 0.000 |
| no-layer-skip | 7 | 7 | 0 | 0 | 1.000 | [0.646, 1.000] | 0.000 |
| repository-aggregate-root | 6 | 6 | 0 | 0 | 1.000 | [0.610, 1.000] | 0.000 |

| style project | n | correct | incorrect | not-checkable | precision | Wilson 95% | not-checkable share |
|---|---:|---:|---:|---:|---:|---|---:|
| clean-architecture luizomf-clean-api | 9 | 9 | 0 | 0 | 1.000 | [0.701, 1.000] | 0.000 |
| clean-architecture pvarentsov-clean | 18 | 18 | 0 | 0 | 1.000 | [0.824, 1.000] | 0.000 |
| ddd ddd-forum | 92 | 92 | 0 | 0 | 1.000 | [0.960, 1.000] | 0.000 |
| ddd event-sourcing-ddd | 20 | 20 | 0 | 0 | 1.000 | [0.839, 1.000] | 0.000 |
| ddd finance-project-ddd | 50 | 50 | 0 | 0 | 1.000 | [0.929, 1.000] | 0.000 |
| hexagonal conduit-ports-adapters | 1 | 1 | 0 | 0 | 1.000 | [0.207, 1.000] | 0.000 |
| hexagonal nest-products-hexagonal | 3 | 3 | 0 | 0 | 1.000 | [0.439, 1.000] | 0.000 |
| layered talento90-typescript-node | 4 | 4 | 0 | 0 | 1.000 | [0.510, 1.000] | 0.000 |
| layered w3tec-express-boilerplate | 8 | 8 | 0 | 0 | 1.000 | [0.676, 1.000] | 0.000 |
| nestjs neoteric-nestjs-auth | 72 | 72 | 0 | 0 | 1.000 | [0.949, 1.000] | 0.000 |
| nestjs vivify-nestjs-boilerplate | 6 | 6 | 0 | 0 | 1.000 | [0.610, 1.000] | 0.000 |

## Incorrect blocking findings

None.

## Not-checkable blocking findings

None.

## Advisory sample (secondary)

| pooled | n | correct | incorrect | not-checkable | precision | Wilson 95% | not-checkable share |
|---|---:|---:|---:|---:|---:|---|---:|
| advisory sample | 30 | 18 | 0 | 12 | 1.000 | [0.824, 1.000] | 0.400 |

| style rule/template | n | correct | incorrect | not-checkable | precision | Wilson 95% | not-checkable share |
|---|---:|---:|---:|---:|---:|---|---:|
| clean-architecture FF-C03/component-instability | 3 | 0 | 0 | 3 | n/a | n/a | 1.000 |
| clean-architecture FF-C04/no-orphan-files | 1 | 0 | 0 | 1 | n/a | n/a | 1.000 |
| clean-architecture FF-CV05/test-file-pairing | 11 | 11 | 0 | 0 | 1.000 | [0.741, 1.000] | 0.000 |
| ddd FF-S03/layer-skip-graph | 1 | 1 | 0 | 0 | 1.000 | [0.207, 1.000] | 0.000 |
| hexagonal FF-CV05/test-file-pairing | 2 | 2 | 0 | 0 | 1.000 | [0.342, 1.000] | 0.000 |
| layered FF-C03/component-instability | 1 | 0 | 0 | 1 | n/a | n/a | 1.000 |
| layered FF-C04/no-orphan-files | 1 | 0 | 0 | 1 | n/a | n/a | 1.000 |
| layered FF-CV05/test-file-pairing | 1 | 1 | 0 | 0 | 1.000 | [0.207, 1.000] | 0.000 |
| nestjs FF-C03/component-instability | 2 | 0 | 0 | 2 | n/a | n/a | 1.000 |
| nestjs FF-C04/no-orphan-files | 1 | 0 | 0 | 1 | n/a | n/a | 1.000 |
| nestjs FF-C06/abstraction-ratio | 1 | 0 | 0 | 1 | n/a | n/a | 1.000 |
| nestjs FF-CV05/test-file-pairing | 3 | 3 | 0 | 0 | 1.000 | [0.439, 1.000] | 0.000 |
| nestjs FF-CV06/no-index-logic | 1 | 0 | 0 | 1 | n/a | n/a | 1.000 |
| nestjs FF-SO01/single-responsibility-proxy | 1 | 0 | 0 | 1 | n/a | n/a | 1.000 |
