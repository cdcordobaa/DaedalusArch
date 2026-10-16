# External set, deterministic correctness: summary

Pass criterion (every one of 342 blocking findings labelled with evidence): **met** (342 labelled of 342 checked).

## Blocking findings

| pooled | n | correct | incorrect | not-checkable | precision | Wilson 95% | not-checkable share |
|---|---:|---:|---:|---:|---:|---|---:|
| all blocking | 342 | 342 | 0 | 0 | 1.000 | [0.989, 1.000] | 0.000 |

| style | n | correct | incorrect | not-checkable | precision | Wilson 95% | not-checkable share |
|---|---:|---:|---:|---:|---:|---|---:|
| clean-architecture | 29 | 29 | 0 | 0 | 1.000 | [0.883, 1.000] | 0.000 |
| ddd | 19 | 19 | 0 | 0 | 1.000 | [0.832, 1.000] | 0.000 |
| hexagonal | 48 | 48 | 0 | 0 | 1.000 | [0.926, 1.000] | 0.000 |
| layered | 63 | 63 | 0 | 0 | 1.000 | [0.943, 1.000] | 0.000 |
| nestjs | 183 | 183 | 0 | 0 | 1.000 | [0.979, 1.000] | 0.000 |

| style rule/template | n | correct | incorrect | not-checkable | precision | Wilson 95% | not-checkable share |
|---|---:|---:|---:|---:|---:|---|---:|
| clean-architecture FF-P03/repository-pattern | 1 | 1 | 0 | 0 | 1.000 | [0.207, 1.000] | 0.000 |
| clean-architecture FF-S01/dependency-direction | 17 | 17 | 0 | 0 | 1.000 | [0.816, 1.000] | 0.000 |
| clean-architecture FF-S02/no-cyclic-deps | 11 | 11 | 0 | 0 | 1.000 | [0.741, 1.000] | 0.000 |
| ddd FF-DS01/bounded-context-modules | 2 | 2 | 0 | 0 | 1.000 | [0.342, 1.000] | 0.000 |
| ddd FF-DS02/context-isolation | 6 | 6 | 0 | 0 | 1.000 | [0.610, 1.000] | 0.000 |
| ddd FF-DT04/domain-purity | 11 | 11 | 0 | 0 | 1.000 | [0.741, 1.000] | 0.000 |
| hexagonal FF-P01/domain-purity | 1 | 1 | 0 | 0 | 1.000 | [0.207, 1.000] | 0.000 |
| hexagonal FF-P03/port-adapter-pattern | 7 | 7 | 0 | 0 | 1.000 | [0.646, 1.000] | 0.000 |
| hexagonal FF-S01/dependency-direction-graph | 31 | 31 | 0 | 0 | 1.000 | [0.890, 1.000] | 0.000 |
| hexagonal FF-S02/no-cyclic-deps | 9 | 9 | 0 | 0 | 1.000 | [0.701, 1.000] | 0.000 |
| layered FF-P01/domain-purity | 3 | 3 | 0 | 0 | 1.000 | [0.439, 1.000] | 0.000 |
| layered FF-S01/dependency-direction | 8 | 8 | 0 | 0 | 1.000 | [0.676, 1.000] | 0.000 |
| layered FF-S02/no-cyclic-deps | 25 | 25 | 0 | 0 | 1.000 | [0.867, 1.000] | 0.000 |
| layered FF-S03/no-layer-skip | 27 | 27 | 0 | 0 | 1.000 | [0.875, 1.000] | 0.000 |
| nestjs FF-P01/domain-purity | 15 | 15 | 0 | 0 | 1.000 | [0.796, 1.000] | 0.000 |
| nestjs FF-P03/repository-pattern | 13 | 13 | 0 | 0 | 1.000 | [0.772, 1.000] | 0.000 |
| nestjs FF-S01/dependency-direction | 40 | 40 | 0 | 0 | 1.000 | [0.912, 1.000] | 0.000 |
| nestjs FF-S02/no-cyclic-deps | 102 | 102 | 0 | 0 | 1.000 | [0.964, 1.000] | 0.000 |
| nestjs FF-S04/no-domain-outward-dep | 13 | 13 | 0 | 0 | 1.000 | [0.772, 1.000] | 0.000 |

| template | n | correct | incorrect | not-checkable | precision | Wilson 95% | not-checkable share |
|---|---:|---:|---:|---:|---:|---|---:|
| bounded-context-modules | 2 | 2 | 0 | 0 | 1.000 | [0.342, 1.000] | 0.000 |
| context-isolation | 6 | 6 | 0 | 0 | 1.000 | [0.610, 1.000] | 0.000 |
| dependency-direction | 65 | 65 | 0 | 0 | 1.000 | [0.944, 1.000] | 0.000 |
| dependency-direction-graph | 31 | 31 | 0 | 0 | 1.000 | [0.890, 1.000] | 0.000 |
| domain-purity | 30 | 30 | 0 | 0 | 1.000 | [0.886, 1.000] | 0.000 |
| no-cyclic-deps | 147 | 147 | 0 | 0 | 1.000 | [0.975, 1.000] | 0.000 |
| no-domain-outward-dep | 13 | 13 | 0 | 0 | 1.000 | [0.772, 1.000] | 0.000 |
| no-layer-skip | 27 | 27 | 0 | 0 | 1.000 | [0.875, 1.000] | 0.000 |
| port-adapter-pattern | 7 | 7 | 0 | 0 | 1.000 | [0.646, 1.000] | 0.000 |
| repository-pattern | 14 | 14 | 0 | 0 | 1.000 | [0.785, 1.000] | 0.000 |

| style project | n | correct | incorrect | not-checkable | precision | Wilson 95% | not-checkable share |
|---|---:|---:|---:|---:|---:|---|---:|
| clean-architecture adilsonfuxe-auth | 1 | 1 | 0 | 0 | 1.000 | [0.207, 1.000] | 0.000 |
| clean-architecture felixle-node-core | 7 | 7 | 0 | 0 | 1.000 | [0.646, 1.000] | 0.000 |
| clean-architecture jamielivingstone-clean | 15 | 15 | 0 | 0 | 1.000 | [0.796, 1.000] | 0.000 |
| clean-architecture nutes-template-base | 6 | 6 | 0 | 0 | 1.000 | [0.610, 1.000] | 0.000 |
| ddd mustodon | 6 | 6 | 0 | 0 | 1.000 | [0.610, 1.000] | 0.000 |
| ddd pezzetti-base-app | 10 | 10 | 0 | 0 | 1.000 | [0.722, 1.000] | 0.000 |
| ddd talyssonoc-node-api | 3 | 3 | 0 | 0 | 1.000 | [0.439, 1.000] | 0.000 |
| hexagonal hexapinod | 3 | 3 | 0 | 0 | 1.000 | [0.439, 1.000] | 0.000 |
| hexagonal quiz4devs-backend | 10 | 10 | 0 | 0 | 1.000 | [0.722, 1.000] | 0.000 |
| hexagonal remix-hexagonal | 30 | 30 | 0 | 0 | 1.000 | [0.886, 1.000] | 0.000 |
| hexagonal ts-seed-hexagonal | 5 | 5 | 0 | 0 | 1.000 | [0.566, 1.000] | 0.000 |
| layered geekyants-express | 6 | 6 | 0 | 0 | 1.000 | [0.610, 1.000] | 0.000 |
| layered ngduc-node-rem | 5 | 5 | 0 | 0 | 1.000 | [0.566, 1.000] | 0.000 |
| layered shihabmridha-repo-ioc | 1 | 1 | 0 | 0 | 1.000 | [0.207, 1.000] | 0.000 |
| layered typeplate | 51 | 51 | 0 | 0 | 1.000 | [0.930, 1.000] | 0.000 |
| nestjs bank-server | 165 | 165 | 0 | 0 | 1.000 | [0.977, 1.000] | 0.000 |
| nestjs monstarlab-nestjs-starter | 12 | 12 | 0 | 0 | 1.000 | [0.758, 1.000] | 0.000 |
| nestjs saluki-nestjs-template | 2 | 2 | 0 | 0 | 1.000 | [0.342, 1.000] | 0.000 |
| nestjs staart-api | 4 | 4 | 0 | 0 | 1.000 | [0.510, 1.000] | 0.000 |

## Incorrect blocking findings

None.

## Not-checkable blocking findings

None.

## Advisory sample (secondary)

| pooled | n | correct | incorrect | not-checkable | precision | Wilson 95% | not-checkable share |
|---|---:|---:|---:|---:|---:|---|---:|
| advisory sample | 30 | 15 | 1 | 14 | 0.938 | [0.717, 0.989] | 0.467 |

| style rule/template | n | correct | incorrect | not-checkable | precision | Wilson 95% | not-checkable share |
|---|---:|---:|---:|---:|---:|---|---:|
| clean-architecture FF-C03/component-instability | 1 | 0 | 0 | 1 | n/a | n/a | 1.000 |
| clean-architecture FF-C05/max-fan-in | 1 | 0 | 0 | 1 | n/a | n/a | 1.000 |
| clean-architecture FF-CV05/test-file-pairing | 7 | 6 | 1 | 0 | 0.857 | [0.487, 0.974] | 0.000 |
| clean-architecture FF-SO01/single-responsibility-proxy | 1 | 0 | 0 | 1 | n/a | n/a | 1.000 |
| hexagonal FF-CV05/test-file-pairing | 5 | 5 | 0 | 0 | 1.000 | [0.566, 1.000] | 0.000 |
| layered FF-CV05/test-file-pairing | 1 | 1 | 0 | 0 | 1.000 | [0.207, 1.000] | 0.000 |
| layered FF-CV06/no-index-logic | 1 | 0 | 0 | 1 | n/a | n/a | 1.000 |
| nestjs FF-C03/component-instability | 3 | 0 | 0 | 3 | n/a | n/a | 1.000 |
| nestjs FF-C04/no-orphan-files | 1 | 0 | 0 | 1 | n/a | n/a | 1.000 |
| nestjs FF-C06/abstraction-ratio | 1 | 0 | 0 | 1 | n/a | n/a | 1.000 |
| nestjs FF-CV05/test-file-pairing | 3 | 3 | 0 | 0 | 1.000 | [0.439, 1.000] | 0.000 |
| nestjs FF-P02/dependency-inversion | 4 | 0 | 0 | 4 | n/a | n/a | 1.000 |
| nestjs FF-P04/use-case-isolation | 1 | 0 | 0 | 1 | n/a | n/a | 1.000 |
