# v1.3 reference validation (live run)

| Style | Variants | Planted detected | Silent clean/near-miss | Blocking recall | Blocking precision | Blocking precision (distinct) | All recall | All precision |
|---|---|---|---|---|---|---|---|---|
| clean-architecture | 14 | 8/10 | 3/4 | 0.92 | 0.86 | 0.86 | 0.88 | 0.88 |
| layered | 13 | 7/9 | 0/4 | 0.82 | 0.14 | 0.56 | 0.82 | 0.14 |
| nestjs | 14 | 8/10 | 3/4 | 0.91 | 0.91 | 0.91 | 0.85 | 0.79 |
| hexagonal | 15 | 10/11 | 3/4 | 0.92 | 0.86 | 0.86 | 0.94 | 0.88 |
| ddd | 15 | 10/12 | 3/3 | 0.78 | 1.00 | 1.00 | 0.83 | 1.00 |

## clean-architecture

| Rule | Name | Blocking candidate | TP | FN | FP | FP distinct | Recall | Precision |
|---|---|---|---|---|---|---|---|---|
| FF-S01 | dependency-direction | yes | 5 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S02 | no-cyclic-deps | yes | 0 | 1 | 1 | 1 | 0.00 | 0.00 |
| FF-S04 | no-domain-outward-dep | yes | 3 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P01 | domain-purity | yes | 2 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P02 | dependency-inversion | no | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P03 | repository-pattern | yes | 1 | 0 | 1 | 1 | 1.00 | 0.50 |
| FF-P04 | use-case-isolation | no | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P05 | controller-no-entity | no | 0 | 1 | 0 | 0 | 0.00 | n/a |
| FF-P06 | domain-state-purity | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |

| Variant | Kind | Mismatch | Rule | File | Target | Note |
|---|---|---|---|---|---|---|
| n02-report-writer-named-like-repo | near-miss | unexpected | FF-P03 | src/infrastructure/http/CsvReportWriter.ts |  |  |
| v03-domain-entity-cycle | violation | missed | FF-S02 | src/domain/entities/Loan.ts | src/domain/entities/Member.ts | Two-file import cycle Loan -> Member -> Loan (ADP). The row is keyed on the lexicographically smallest path of the cycle. |
| v03-domain-entity-cycle | violation | unexpected | FF-S02 | src/domain/entities/Loan.ts,src/domain/entities/Member.ts,src/domain/entities/Loan.ts | src/domain/entities/Member.ts |  |
| v07-controller-reads-entity | violation | missed | FF-P05 | src/infrastructure/http/LoanController.ts | src/domain/entities/Loan.ts | A controller references a domain entity (Loan) directly instead of a use case and its DTO. |

## layered

| Rule | Name | Blocking candidate | TP | FN | FP | FP distinct | Recall | Precision |
|---|---|---|---|---|---|---|---|---|
| FF-S01 | dependency-direction | yes | 2 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S02 | no-cyclic-deps | yes | 0 | 2 | 2 | 2 | 0.00 | 0.00 |
| FF-S03 | no-layer-skip | yes | 5 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P01 | domain-purity | yes | 2 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P06 | domain-state-purity | yes | 0 | 0 | 53 | 5 | n/a | 0.00 |

| Variant | Kind | Mismatch | Rule | File | Target | Note |
|---|---|---|---|---|---|---|
| clean | clean | unexpected | FF-P06 | src/business/services/CatalogService.ts | src/persistence/ProductGateway.ts |  |
| clean | clean | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/CustomerGateway.ts |  |
| clean | clean | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/OrderGateway.ts |  |
| clean | clean | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/ProductGateway.ts |  |
| n01-controller-parses-money | near-miss | unexpected | FF-P06 | src/business/services/CatalogService.ts | src/persistence/ProductGateway.ts | also on the clean variant |
| n01-controller-parses-money | near-miss | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/CustomerGateway.ts | also on the clean variant |
| n01-controller-parses-money | near-miss | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/OrderGateway.ts | also on the clean variant |
| n01-controller-parses-money | near-miss | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/ProductGateway.ts | also on the clean variant |
| n02-reporting-service-reads-database | near-miss | unexpected | FF-P06 | src/business/services/CatalogService.ts | src/persistence/ProductGateway.ts | also on the clean variant |
| n02-reporting-service-reads-database | near-miss | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/CustomerGateway.ts | also on the clean variant |
| n02-reporting-service-reads-database | near-miss | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/OrderGateway.ts | also on the clean variant |
| n02-reporting-service-reads-database | near-miss | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/ProductGateway.ts | also on the clean variant |
| n02-reporting-service-reads-database | near-miss | unexpected | FF-P06 | src/business/services/SalesReportService.ts | src/persistence/Database.ts |  |
| n03-views-import-model-barrel | near-miss | unexpected | FF-P06 | src/business/services/CatalogService.ts | src/persistence/ProductGateway.ts | also on the clean variant |
| n03-views-import-model-barrel | near-miss | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/CustomerGateway.ts | also on the clean variant |
| n03-views-import-model-barrel | near-miss | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/OrderGateway.ts | also on the clean variant |
| n03-views-import-model-barrel | near-miss | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/ProductGateway.ts | also on the clean variant |
| v01-gateway-returns-business-money | violation | unexpected | FF-P06 | src/business/services/CatalogService.ts | src/persistence/ProductGateway.ts | also on the clean variant |
| v01-gateway-returns-business-money | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/CustomerGateway.ts | also on the clean variant |
| v01-gateway-returns-business-money | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/OrderGateway.ts | also on the clean variant |
| v01-gateway-returns-business-money | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/ProductGateway.ts | also on the clean variant |
| v02-service-renders-view | violation | unexpected | FF-P06 | src/business/services/CatalogService.ts | src/persistence/ProductGateway.ts | also on the clean variant |
| v02-service-renders-view | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/CustomerGateway.ts | also on the clean variant |
| v02-service-renders-view | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/OrderGateway.ts | also on the clean variant |
| v02-service-renders-view | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/ProductGateway.ts | also on the clean variant |
| v03-controller-reads-gateway | violation | unexpected | FF-P06 | src/business/services/CatalogService.ts | src/persistence/ProductGateway.ts | also on the clean variant |
| v03-controller-reads-gateway | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/CustomerGateway.ts | also on the clean variant |
| v03-controller-reads-gateway | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/OrderGateway.ts | also on the clean variant |
| v03-controller-reads-gateway | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/ProductGateway.ts | also on the clean variant |
| v04-view-types-persistence-record | violation | unexpected | FF-P06 | src/business/services/CatalogService.ts | src/persistence/ProductGateway.ts | also on the clean variant |
| v04-view-types-persistence-record | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/CustomerGateway.ts | also on the clean variant |
| v04-view-types-persistence-record | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/OrderGateway.ts | also on the clean variant |
| v04-view-types-persistence-record | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/ProductGateway.ts | also on the clean variant |
| v05-business-model-cycle | violation | missed | FF-S02 | src/business/model/Customer.ts | src/business/model/Order.ts | Two-file import cycle Customer -> Order -> Customer. |
| v05-business-model-cycle | violation | unexpected | FF-S02 | src/business/model/Customer.ts,src/business/model/Order.ts,src/business/model/Customer.ts | src/business/model/Order.ts |  |
| v05-business-model-cycle | violation | unexpected | FF-P06 | src/business/services/CatalogService.ts | src/persistence/ProductGateway.ts | also on the clean variant |
| v05-business-model-cycle | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/CustomerGateway.ts | also on the clean variant |
| v05-business-model-cycle | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/OrderGateway.ts | also on the clean variant |
| v05-business-model-cycle | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/ProductGateway.ts | also on the clean variant |
| v06-router-controller-cycle | violation | missed | FF-S02 | src/presentation/Router.ts | src/presentation/http/OrderController.ts | Two-file import cycle Router -> OrderController -> Router. "src/presentation/Router.ts" sorts before "src/presentation/http/..." (R < h). |
| v06-router-controller-cycle | violation | unexpected | FF-S02 | src/presentation/Router.ts,src/presentation/http/OrderController.ts,src/presentation/Router.ts | src/presentation/http/OrderController.ts |  |
| v06-router-controller-cycle | violation | unexpected | FF-P06 | src/business/services/CatalogService.ts | src/persistence/ProductGateway.ts | also on the clean variant |
| v06-router-controller-cycle | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/CustomerGateway.ts | also on the clean variant |
| v06-router-controller-cycle | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/OrderGateway.ts | also on the clean variant |
| v06-router-controller-cycle | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/ProductGateway.ts | also on the clean variant |
| v07-business-model-typeorm-decorator | violation | unexpected | FF-P06 | src/business/services/CatalogService.ts | src/persistence/ProductGateway.ts | also on the clean variant |
| v07-business-model-typeorm-decorator | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/CustomerGateway.ts | also on the clean variant |
| v07-business-model-typeorm-decorator | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/OrderGateway.ts | also on the clean variant |
| v07-business-model-typeorm-decorator | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/ProductGateway.ts | also on the clean variant |
| v08-business-service-takes-express-request | violation | unexpected | FF-P06 | src/business/services/CatalogService.ts | src/persistence/ProductGateway.ts | also on the clean variant |
| v08-business-service-takes-express-request | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/CustomerGateway.ts | also on the clean variant |
| v08-business-service-takes-express-request | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/OrderGateway.ts | also on the clean variant |
| v08-business-service-takes-express-request | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/ProductGateway.ts | also on the clean variant |
| v09-presentation-root-builds-database | violation | unexpected | FF-P06 | src/business/services/CatalogService.ts | src/persistence/ProductGateway.ts | also on the clean variant |
| v09-presentation-root-builds-database | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/CustomerGateway.ts | also on the clean variant |
| v09-presentation-root-builds-database | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/OrderGateway.ts | also on the clean variant |
| v09-presentation-root-builds-database | violation | unexpected | FF-P06 | src/business/services/OrderService.ts | src/persistence/ProductGateway.ts | also on the clean variant |

## nestjs

| Rule | Name | Blocking candidate | TP | FN | FP | FP distinct | Recall | Precision |
|---|---|---|---|---|---|---|---|---|
| FF-S01 | dependency-direction | yes | 4 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S02 | no-cyclic-deps | yes | 0 | 1 | 1 | 1 | 0.00 | 0.00 |
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
| v04-response-dto-cycle | violation | missed | FF-S02 | src/registrations/dto/registration-response.dto.ts | src/workshops/dto/workshop-response.dto.ts | Two-file import cycle between the response DTOs ("src/registrations/..." sorts before "src/workshops/..."). |
| v04-response-dto-cycle | violation | unexpected | FF-S02 | src/registrations/dto/registration-response.dto.ts,src/workshops/dto/workshop-response.dto.ts,src/registrations/dto/registration-response.dto.ts | src/workshops/dto/workshop-response.dto.ts |  |
| v07-service-injects-concrete-repository | violation | unexpected | FF-P04 | src/registrations/registrations.service.ts |  |  |
| v09-controller-returns-entity | violation | missed | FF-P05 | src/workshops/workshops.controller.ts | src/domain/workshop.ts | A controller references and returns a domain entity (Workshop). |

## hexagonal

| Rule | Name | Blocking candidate | TP | FN | FP | FP distinct | Recall | Precision |
|---|---|---|---|---|---|---|---|---|
| FF-S01 | dependency-direction-graph | yes | 5 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S02 | no-cyclic-deps | yes | 0 | 1 | 1 | 1 | 0.00 | 0.00 |
| FF-S03 | layer-skip-graph | no | 2 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S04 | core-isolation | yes | 3 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P01 | domain-purity | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P02 | port-dependency-inversion | no | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-P03 | port-adapter-pattern | yes | 2 | 0 | 1 | 1 | 1.00 | 0.67 |
| FF-P06 | domain-state-purity | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |

| Variant | Kind | Mismatch | Rule | File | Target | Note |
|---|---|---|---|---|---|---|
| n03-gateway-named-helper | near-miss | unexpected | FF-P03 | src/adapters/outbound/payment/GatewayRetryPolicy.ts |  |  |
| v11-domain-model-cycle | violation | missed | FF-S02 | src/domain/model/Booking.ts | src/domain/model/Room.ts | Two-file import cycle Booking -> Room -> Booking. |
| v11-domain-model-cycle | violation | unexpected | FF-S02 | src/domain/model/Booking.ts,src/domain/model/Room.ts,src/domain/model/Booking.ts | src/domain/model/Room.ts |  |

## ddd

| Rule | Name | Blocking candidate | TP | FN | FP | FP distinct | Recall | Precision |
|---|---|---|---|---|---|---|---|---|
| FF-DS01 | bounded-context-modules | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-DS02 | context-isolation | yes | 1 | 1 | 0 | 0 | 0.50 | 1.00 |
| FF-DT01 | aggregate-boundary | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-DT02 | repository-aggregate-root | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-DT03 | value-object-immutability | yes | 1 | 1 | 0 | 0 | 0.50 | 1.00 |
| FF-DT04 | domain-purity | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-DT05 | domain-event-placement | no | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-DT06 | application-service-thin | no | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S01 | dependency-direction-graph | yes | 1 | 0 | 0 | 0 | 1.00 | 1.00 |
| FF-S03 | layer-skip-graph | no | 1 | 0 | 0 | 0 | 1.00 | 1.00 |

| Variant | Kind | Mismatch | Rule | File | Target | Note |
|---|---|---|---|---|---|---|
| g01-value-object-setter-accessor | violation | missed | FF-DT03 | src/ordering/domain/value-objects/Quantity.ts |  | Value object Quantity has a public setter (the `set value` accessor) and a non-readonly field (current). |
| g03-deep-import-of-reexported-file | violation | missed | FF-DS02 | src/billing/api/InvoiceController.ts | src/ordering/application/GetOrderSummary.ts | billing imports ordering's GetOrderSummary.ts directly; the file is re-exported by ordering's barrel, but the import does not go through it, and the importer is not in billing's ACL. |
