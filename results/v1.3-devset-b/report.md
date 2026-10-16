# v1.3 reference validation (from saved outputs in results/v1.3-devset-b/raw)

| Style | Variants | Planted detected | Silent clean/near-miss | Blocking recall | Blocking precision | Blocking precision (distinct) | All recall | All precision |
|---|---|---|---|---|---|---|---|---|
| clean-architecture | 25 | 13/16 | 8/9 | 0.88 | 0.88 | 0.88 | 0.88 | 0.88 |
| layered | 24 | 14/15 | 9/9 | 0.95 | 0.95 | 0.95 | 0.95 | 0.95 |
| nestjs | 27 | 14/16 | 11/11 | 0.91 | 0.95 | 0.95 | 0.91 | 0.95 |
| hexagonal | 25 | 15/16 | 9/9 | 0.96 | 0.96 | 0.96 | 0.96 | 0.96 |
| ddd | 35 | 21/21 | 14/14 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |

## clean-architecture

| Rule | Name | Blocking candidate | TP | FN | FP | FP distinct | Recall | Precision |
|---|---|---|---|---|---|---|---|---|
| FF-S01 | dependency-direction | yes | 8 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S02 | no-cyclic-deps | yes | 1 | 2 | 2 | 2 | 0.33 | 0.33 |
| FF-S04 | no-domain-outward-dep | yes | 6 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P01 | domain-purity | yes | 3 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P02 | dependency-inversion | no | 0 | 0 | 0 | 0 | n/a | n/a |
| FF-P03 | repository-pattern | yes | 1 | 1 | 1 | 1 | 0.50 | 0.50 |
| FF-P04 | use-case-isolation | no | 0 | 0 | 0 | 0 | n/a | n/a |
| FF-P05 | controller-no-entity | no | 0 | 0 | 0 | 0 | n/a | n/a |
| FF-P06 | domain-state-purity | yes | 2 | 0 | 0 | 0 | 1.00 | 1.00 |

| Variant | Kind | Mismatch | Rule | File | Target | Note |
|---|---|---|---|---|---|---|
| v27-loan-period-reads-policy-limit-cycle | violation | missed | FF-S02 | src/domain/entities/Loan.ts | src/domain/value-objects/LoanPeriod.ts | Three-file import cycle Loan -> LoanPeriod -> LoanPolicy -> Loan (ADP); keyed on the lexicographically smallest path, target the next file of the cycle. |
| v27-loan-period-reads-policy-limit-cycle | violation | unexpected | FF-S02 | src/domain/entities/Loan.ts,src/domain/value-objects/LoanPeriod.ts,src/domain/services/LoanPolicy.ts,src/domain/entities/Loan.ts | src/domain/value-objects/LoanPeriod.ts |  |
| v29-http-barrel-error-mapper-cycle | violation | missed | FF-S02 | src/infrastructure/http/BookController.ts | src/infrastructure/http/ErrorMapper.ts | Three-file cycle BookController -> ErrorMapper -> index (re-export) -> BookController; keyed on the lexicographically smallest path (B < E < i). |
| v29-http-barrel-error-mapper-cycle | violation | unexpected | FF-S02 | src/infrastructure/http/BookController.ts,src/infrastructure/http/ErrorMapper.ts,src/infrastructure/http/index.ts,src/infrastructure/http/BookController.ts | src/infrastructure/http/ErrorMapper.ts |  |
| v34-member-repository-implements-local-store | violation | missed | FF-P03 | src/infrastructure/persistence/InMemoryMemberRepository.ts |  | An infrastructure repository implements an infrastructure-local interface, not the domain repository interface. |
| n25-caching-book-repository-aliased-port | near-miss | unexpected | FF-P03 | src/infrastructure/persistence/CachingBookRepository.ts |  |  |

## layered

| Rule | Name | Blocking candidate | TP | FN | FP | FP distinct | Recall | Precision |
|---|---|---|---|---|---|---|---|---|
| FF-S01 | dependency-direction | yes | 5 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S02 | no-cyclic-deps | yes | 3 | 1 | 1 | 1 | 0.75 | 0.75 |
| FF-S03 | no-layer-skip | yes | 9 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P01 | domain-purity | yes | 3 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P06 | domain-state-purity | yes | 0 | 0 | 0 | 0 | n/a | n/a |

| Variant | Kind | Mismatch | Rule | File | Target | Note |
|---|---|---|---|---|---|---|
| v30-order-line-product-order-cycle | violation | missed | FF-S02 | src/business/model/Order.ts | src/business/model/OrderLine.ts | Three-file import cycle Order -> OrderLine -> Product -> Order; "Order.ts" sorts before "OrderLine.ts" (. < L). |
| v30-order-line-product-order-cycle | violation | unexpected | FF-S02 | src/business/model/Order.ts,src/business/model/OrderLine.ts,src/business/model/Product.ts,src/business/model/Order.ts | src/business/model/OrderLine.ts |  |

## nestjs

| Rule | Name | Blocking candidate | TP | FN | FP | FP distinct | Recall | Precision |
|---|---|---|---|---|---|---|---|---|
| FF-S01 | dependency-direction | yes | 7 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S02 | no-cyclic-deps | yes | 3 | 1 | 1 | 1 | 0.75 | 0.75 |
| FF-S04 | no-domain-outward-dep | yes | 4 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P01 | domain-purity | yes | 3 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P02 | dependency-inversion | no | 0 | 0 | 0 | 0 | n/a | n/a |
| FF-P03 | repository-pattern | yes | 1 | 1 | 0 | 0 | 0.50 | 1.00 |
| FF-P04 | use-case-isolation | no | 0 | 0 | 0 | 0 | n/a | n/a |
| FF-P05 | controller-no-entity | no | 0 | 0 | 0 | 0 | n/a | n/a |
| FF-P06 | domain-state-purity | yes | 2 | 0 | 0 | 0 | 1.00 | 1.00 |

| Variant | Kind | Mismatch | Rule | File | Target | Note |
|---|---|---|---|---|---|---|
| v26-three-response-dto-cycle | violation | missed | FF-S02 | src/attendees/dto/attendee-response.dto.ts | src/registrations/dto/registration-response.dto.ts | Three-file import cycle attendee-response -> registration-response -> workshop-response -> attendee-response; the smallest path is the attendees DTO and the next file is the registrations DTO. |
| v26-three-response-dto-cycle | violation | unexpected | FF-S02 | src/attendees/dto/attendee-response.dto.ts,src/registrations/dto/registration-response.dto.ts,src/workshops/dto/workshop-response.dto.ts,src/attendees/dto/attendee-response.dto.ts | src/registrations/dto/registration-response.dto.ts |  |
| v32-workshop-repository-local-store-interface | violation | missed | FF-P03 | src/workshops/in-memory-workshop.repository.ts |  | The infrastructure repository implements no domain-owned repository interface; its only interface is declared in the infrastructure layer. |

## hexagonal

| Rule | Name | Blocking candidate | TP | FN | FP | FP distinct | Recall | Precision |
|---|---|---|---|---|---|---|---|---|
| FF-S01 | dependency-direction-graph | yes | 8 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S02 | no-cyclic-deps | yes | 4 | 1 | 1 | 1 | 0.80 | 0.80 |
| FF-S03 | layer-skip-graph | no | 0 | 0 | 0 | 0 | n/a | n/a |
| FF-S04 | core-isolation | yes | 4 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P01 | domain-purity | yes | 2 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P02 | port-dependency-inversion | no | 0 | 0 | 0 | 0 | n/a | n/a |
| FF-P03 | port-adapter-pattern | yes | 3 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P06 | domain-state-purity | yes | 2 | 0 | 0 | 0 | 1.00 | 1.00 |

| Variant | Kind | Mismatch | Rule | File | Target | Note |
|---|---|---|---|---|---|---|
| v26-http-links-routes-cycle | violation | missed | FF-S02 | src/adapters/inbound/http/BookingController.ts | src/adapters/inbound/http/links.ts | Three-file import cycle BookingController -> links -> routes -> BookingController. |
| v26-http-links-routes-cycle | violation | unexpected | FF-S02 | src/adapters/inbound/http/BookingController.ts,src/adapters/inbound/http/links.ts,src/adapters/inbound/http/routes.ts,src/adapters/inbound/http/BookingController.ts | src/adapters/inbound/http/links.ts |  |

## ddd

| Rule | Name | Blocking candidate | TP | FN | FP | FP distinct | Recall | Precision |
|---|---|---|---|---|---|---|---|---|
| FF-DS01 | bounded-context-modules | yes | 4 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-DS02 | context-isolation | yes | 5 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-DT01 | aggregate-boundary | yes | 4 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-DT02 | repository-aggregate-root | yes | 3 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-DT03 | value-object-immutability | yes | 3 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-DT04 | domain-purity | yes | 3 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-DT05 | domain-event-placement | no | 0 | 0 | 0 | 0 | n/a | n/a |
| FF-DT06 | application-service-thin | no | 0 | 0 | 0 | 0 | n/a | n/a |
| FF-S01 | dependency-direction-graph | yes | 3 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S03 | layer-skip-graph | no | 0 | 0 | 0 | 0 | n/a | n/a |

No mismatch.
