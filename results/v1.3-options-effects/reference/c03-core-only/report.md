# v1.3 reference validation (live run)

| Style | Variants | Planted detected | Silent clean/near-miss | Blocking recall | Blocking precision | Blocking precision (distinct) | All recall | All precision |
|---|---|---|---|---|---|---|---|---|
| clean-architecture | 14 | 9/10 | 4/4 | 1.00 | 1.00 | 1.00 | 0.94 | 1.00 |
| layered | 13 | 9/9 | 4/4 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| nestjs | 14 | 9/10 | 3/4 | 1.00 | 1.00 | 1.00 | 0.92 | 0.86 |
| hexagonal | 15 | 11/11 | 4/4 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| ddd | 15 | 12/12 | 3/3 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |

## clean-architecture

| Rule | Name | Blocking candidate | TP | FN | FP | FP distinct | Recall | Precision |
|---|---|---|---|---|---|---|---|---|
| FF-S01 | dependency-direction | yes | 5 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S02 | no-cyclic-deps | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S04 | no-domain-outward-dep | yes | 3 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P01 | domain-purity | yes | 2 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P02 | dependency-inversion | no | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P03 | repository-pattern | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P04 | use-case-isolation | no | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P05 | controller-no-entity | no | 0 | 1 | 0 | 0 | 0.00 | n/a |
| FF-P06 | domain-state-purity | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |

| Variant | Kind | Mismatch | Rule | File | Target | Note |
|---|---|---|---|---|---|---|
| v07-controller-reads-entity | violation | missed | FF-P05 | src/infrastructure/http/LoanController.ts | src/domain/entities/Loan.ts | A controller references a domain entity (Loan) directly instead of a use case and its DTO. |

## layered

| Rule | Name | Blocking candidate | TP | FN | FP | FP distinct | Recall | Precision |
|---|---|---|---|---|---|---|---|---|
| FF-S01 | dependency-direction | yes | 2 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S02 | no-cyclic-deps | yes | 2 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S03 | no-layer-skip | yes | 5 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P01 | domain-purity | yes | 2 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P06 | domain-state-purity | yes | 0 | 0 | 0 | 0 | n/a | n/a |

No mismatch.

## nestjs

| Rule | Name | Blocking candidate | TP | FN | FP | FP distinct | Recall | Precision |
|---|---|---|---|---|---|---|---|---|
| FF-S01 | dependency-direction | yes | 4 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S02 | no-cyclic-deps | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S04 | no-domain-outward-dep | yes | 2 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P01 | domain-purity | yes | 2 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P02 | dependency-inversion | no | 1 | 0 | 1 | 1 | 1.00 | 0.50 |
| FF-P03 | repository-pattern | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P04 | use-case-isolation | no | 0 | 0 | 1 | 1 | n/a | 0.00 |
| FF-P05 | controller-no-entity | no | 0 | 1 | 0 | 0 | 0.00 | n/a |
| FF-P06 | domain-state-purity | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |

| Variant | Kind | Mismatch | Rule | File | Target | Note |
|---|---|---|---|---|---|---|
| n03-service-injects-sibling-service | near-miss | unexpected | FF-P02 | src/registrations/registrations.service.ts |  |  |
| v07-service-injects-concrete-repository | violation | unexpected | FF-P04 | src/registrations/registrations.service.ts |  |  |
| v09-controller-returns-entity | violation | missed | FF-P05 | src/workshops/workshops.controller.ts | src/domain/workshop.ts | A controller references and returns a domain entity (Workshop). |

## hexagonal

| Rule | Name | Blocking candidate | TP | FN | FP | FP distinct | Recall | Precision |
|---|---|---|---|---|---|---|---|---|
| FF-S01 | dependency-direction-graph | yes | 5 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S02 | no-cyclic-deps | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S03 | layer-skip-graph | no | 2 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S04 | core-isolation | yes | 3 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P01 | domain-purity | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P02 | port-dependency-inversion | no | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P03 | port-adapter-pattern | yes | 2 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P06 | domain-state-purity | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |

No mismatch.

## ddd

| Rule | Name | Blocking candidate | TP | FN | FP | FP distinct | Recall | Precision |
|---|---|---|---|---|---|---|---|---|
| FF-DS01 | bounded-context-modules | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-DS02 | context-isolation | yes | 2 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-DT01 | aggregate-boundary | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-DT02 | repository-aggregate-root | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-DT03 | value-object-immutability | yes | 2 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-DT04 | domain-purity | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-DT05 | domain-event-placement | no | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-DT06 | application-service-thin | no | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S01 | dependency-direction-graph | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S03 | layer-skip-graph | no | 1 | 0 | 0 | 0 | 1.00 | 1.00 |

No mismatch.
