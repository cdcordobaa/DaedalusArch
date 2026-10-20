# v1.3 reference validation (live run)

| Style | Variants | Planted detected | Silent clean/near-miss | Blocking recall | Blocking precision | Blocking precision (distinct) | All recall | All precision |
|---|---|---|---|---|---|---|---|---|
| clean-architecture | 14 | 9/10 | 4/4 | 1.00 | 1.00 | 1.00 | 0.94 | 1.00 |
| layered | 13 | 7/9 | 4/4 | 0.64 | 1.00 | 1.00 | 0.64 | 1.00 |
| nestjs | 14 | 9/10 | 4/4 | 1.00 | 1.00 | 1.00 | 0.92 | 1.00 |
| hexagonal | 15 | 9/11 | 4/4 | 0.92 | 0.75 | 0.75 | 0.81 | 0.76 |
| ddd | 15 | 11/12 | 2/3 | 1.00 | 0.82 | 0.82 | 0.92 | 0.85 |

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
| FF-S03 | no-layer-skip | yes | 3 | 2 | 0 | 0 | 0.60 | 1.00 |
| FF-P01 | domain-purity | yes | 0 | 2 | 0 | 0 | 0.00 | n/a |
| FF-P06 | domain-state-purity | yes | 0 | 0 | 0 | 0 | n/a | n/a |

| Variant | Kind | Mismatch | Rule | File | Target | Note |
|---|---|---|---|---|---|---|
| v01-gateway-returns-business-money | violation | missed | FF-S03 | src/persistence/ProductGateway.ts | src/business/model/Money.ts | persistence > business is not an allowed transition (only business > persistence and presentation > business are). |
| v02-service-renders-view | violation | missed | FF-S03 | src/business/services/OrderService.ts | src/presentation/views/OrderView.ts | business > presentation is not an allowed transition. |
| v07-business-model-typeorm-decorator | violation | missed | FF-P01 | src/business/model/Order.ts | typeorm | The business (domain-kind) layer imports typeorm. |
| v08-business-service-takes-express-request | violation | missed | FF-P01 | src/business/services/OrderService.ts | express | The business layer imports the web framework express. |

## nestjs

| Rule | Name | Blocking candidate | TP | FN | FP | FP distinct | Recall | Precision |
|---|---|---|---|---|---|---|---|---|
| FF-S01 | dependency-direction | yes | 4 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S02 | no-cyclic-deps | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S04 | no-domain-outward-dep | yes | 2 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P01 | domain-purity | yes | 2 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P02 | dependency-inversion | no | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P03 | repository-pattern | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P04 | use-case-isolation | no | 0 | 0 | 0 | 0 | n/a | n/a |
| FF-P05 | controller-no-entity | no | 0 | 1 | 0 | 0 | 0.00 | n/a |
| FF-P06 | domain-state-purity | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |

| Variant | Kind | Mismatch | Rule | File | Target | Note |
|---|---|---|---|---|---|---|
| v09-controller-returns-entity | violation | missed | FF-P05 | src/workshops/workshops.controller.ts | src/domain/workshop.ts | A controller references and returns a domain entity (Workshop). |

## hexagonal

| Rule | Name | Blocking candidate | TP | FN | FP | FP distinct | Recall | Precision |
|---|---|---|---|---|---|---|---|---|
| FF-S01 | dependency-direction-graph | yes | 5 | 0 | 2 | 2 | 1.00 | 0.71 |
| FF-S02 | no-cyclic-deps | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S03 | layer-skip-graph | no | 0 | 2 | 0 | 0 | 0.00 | n/a |
| FF-S04 | core-isolation | yes | 2 | 1 | 2 | 2 | 0.67 | 0.50 |
| FF-P01 | domain-purity | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P02 | port-dependency-inversion | no | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P03 | port-adapter-pattern | yes | 2 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P06 | domain-state-purity | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |

| Variant | Kind | Mismatch | Rule | File | Target | Note |
|---|---|---|---|---|---|---|
| v02-domain-entity-uses-driven-port | violation | missed | FF-S04 | src/domain/model/Booking.ts | src/application/ports/out/NotificationSender.ts | The core imports a file outside the domain layer. |
| v03-use-case-injects-concrete-adapter | violation | unexpected | FF-S04 | src/application/services/FindAvailableRoomsService.ts | src/adapters/outbound/persistence/InMemoryRoomRepository.ts |  |
| v04-use-case-throws-http-error | violation | unexpected | FF-S04 | src/application/services/CancelBookingService.ts | src/adapters/inbound/http/HttpTypes.ts |  |
| v05-inbound-adapter-reads-outbound-adapter | violation | missed | FF-S03 | src/adapters/inbound/http/RoomController.ts | src/adapters/outbound/persistence/InMemoryRoomRepository.ts | adapters-inbound and adapters-outbound have no allowed edge in either direction. |
| v05-inbound-adapter-reads-outbound-adapter | violation | unexpected | FF-S01 | src/adapters/inbound/http/RoomController.ts | src/adapters/outbound/persistence/InMemoryRoomRepository.ts |  |
| v06-outbound-adapter-uses-cli-formatter | violation | missed | FF-S03 | src/adapters/outbound/notification/OutboxNotificationAdapter.ts | src/adapters/inbound/cli/BookingCli.ts | adapters-outbound and adapters-inbound have no allowed edge in either direction. |
| v06-outbound-adapter-uses-cli-formatter | violation | unexpected | FF-S01 | src/adapters/outbound/notification/OutboxNotificationAdapter.ts | src/adapters/inbound/cli/BookingCli.ts |  |

## ddd

| Rule | Name | Blocking candidate | TP | FN | FP | FP distinct | Recall | Precision |
|---|---|---|---|---|---|---|---|---|
| FF-DS01 | bounded-context-modules | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-DS02 | context-isolation | yes | 2 | 0 | 1 | 1 | 1.00 | 0.67 |
| FF-DT01 | aggregate-boundary | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-DT02 | repository-aggregate-root | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-DT03 | value-object-immutability | yes | 2 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-DT04 | domain-purity | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-DT05 | domain-event-placement | no | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-DT06 | application-service-thin | no | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S01 | dependency-direction-graph | yes | 1 | 0 | 1 | 1 | 1.00 | 0.50 |
| FF-S03 | layer-skip-graph | no | 0 | 1 | 0 | 0 | 0.00 | n/a |

| Variant | Kind | Mismatch | Rule | File | Target | Note |
|---|---|---|---|---|---|---|
| n01-acl-internal-import | near-miss | unexpected | FF-DS02 | src/billing/acl/OrderingAcl.ts | src/ordering/domain/order/value-objects/OrderId.ts |  |
| v10-api-imports-infrastructure | violation | missed | FF-S03 | src/ordering/api/OrderController.ts | src/ordering/infrastructure/InMemoryOrderRepository.ts | api imports infrastructure; there is no allowed edge between the two layers in either direction. |
| v10-api-imports-infrastructure | violation | unexpected | FF-S01 | src/ordering/api/OrderController.ts | src/ordering/infrastructure/InMemoryOrderRepository.ts |  |
