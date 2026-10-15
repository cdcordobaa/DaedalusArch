# ISE prototype: downstream findings (d), inferred spec vs true spec

| Target | True style | Inferred style | Verdict agrees | Blocking set identical | Mean blocking Jaccard | Planted detected (true spec) | Planted detected (inferred spec) | Planted touched (true / inferred) | Expected findings matched (true / inferred) |
|---|---|---|---|---|---|---|---|---|---|
| clean-architecture | clean-architecture | clean-architecture | 14/14 | 14/14 | 1.00 | 9/10 | 9/10 | 9/10 / 9/10 | 15/16 / 15/16 |
| layered | layered | layered | 13/13 | 13/13 | 1.00 | 9/9 | 9/9 | 9/9 / 9/9 | 11/11 / 11/11 |
| nestjs | nestjs | nestjs | 14/14 | 14/14 | 1.00 | 9/10 | 9/10 | 9/10 / 9/10 | 12/13 / 12/13 |
| hexagonal | hexagonal | hexagonal | 15/15 | 15/15 | 1.00 | 11/11 | 11/11 | 11/11 / 11/11 | 16/16 / 16/16 |
| ddd | ddd | ddd | 15/15 | 15/15 | 1.00 | 11/12 | 11/12 | 11/12 / 11/12 | 11/12 / 11/12 |
| P1-clean-architecture-renamed | clean-architecture | clean-architecture | 14/14 | 14/14 | 1.00 | 9/10 | 9/10 | 9/10 / 9/10 | 15/16 / 15/16 |
| P2-layered-renamed | layered | layered | 13/13 | 13/13 | 1.00 | 9/9 | 9/9 | 9/9 / 9/9 | 11/11 / 11/11 |
| P3-nestjs-renamed | nestjs | nestjs | 14/14 | 14/14 | 1.00 | 9/10 | 9/10 | 9/10 / 9/10 | 12/13 / 12/13 |
| P4-hexagonal-renamed | hexagonal | clean-architecture | 11/15 | 10/15 | 0.71 | 11/11 | 5/11 | 11/11 / 7/11 | 16/16 / 9/16 |
| P5-ddd-renamed | ddd | clean-architecture | 8/15 | 7/15 | 0.47 | 11/12 | 0/12 | 11/12 / 3/12 | 11/12 / 0/12 |

## clean-architecture

Every variant: identical blocking findings and the same planted-rule outcome.

## layered

Every variant: identical blocking findings and the same planted-rule outcome.

## nestjs

Every variant: identical blocking findings and the same planted-rule outcome.

## hexagonal

Every variant: identical blocking findings and the same planted-rule outcome.

## ddd

Every variant: identical blocking findings and the same planted-rule outcome.

## P1-clean-architecture-renamed

Every variant: identical blocking findings and the same planted-rule outcome.

## P2-layered-renamed

Every variant: identical blocking findings and the same planted-rule outcome.

## P3-nestjs-renamed

Every variant: identical blocking findings and the same planted-rule outcome.

## P4-hexagonal-renamed

| Variant | Kind | Blocking only under inferred | Blocking only under true | Planted (true / inferred) |
|---|---|---|---|---|
| v03-use-case-injects-concrete-adapter | violation |  | FF-S01|src/orchestration/services/FindAvailableRoomsService.ts|src/plugins/exit/persistence/InMemoryRoomRepository.ts | yes / yes |
| v04-use-case-throws-http-error | violation |  | FF-S01|src/orchestration/services/CancelBookingService.ts|src/plugins/entry/http/HttpTypes.ts | yes / no |
| v05-inbound-adapter-reads-outbound-adapter | violation |  |  | yes / no |
| v06-outbound-adapter-uses-cli-formatter | violation |  |  | yes / no |
| v08-adapter-without-port | violation |  | FF-P03|src/plugins/exit/payment/FakePaymentGateway.ts| | yes / no |
| v09-adapter-implements-local-interface | violation |  | FF-P03|src/plugins/exit/persistence/InMemoryRoomRepository.ts| | yes / no |
| v10-domain-service-holds-adapter | violation |  | FF-P06|src/kernel/services/AvailabilityChecker.ts|src/plugins/exit/persistence/InMemoryBookingRepository.ts | yes / no |

## P5-ddd-renamed

| Variant | Kind | Blocking only under inferred | Blocking only under true | Planted (true / inferred) |
|---|---|---|---|---|
| g03-deep-import-of-reexported-file | violation |  | FF-DS02|src/billing/api/InvoiceController.ts|src/ordering/orchestration/GetOrderSummary.ts | yes / no |
| v01-aggregate-boundary | violation |  | FF-DT01|src/ordering/orchestration/GetOrderSummary.ts|src/ordering/kernel/order/OrderLine.ts | yes / no |
| v02-repository-for-inner-entity | violation |  | FF-DT02|src/ordering/kernel/order/OrderLineRepository.ts|src/ordering/kernel/order/OrderLine.ts | yes / no |
| v03-mutable-value-object | violation |  | FF-DT03|src/ordering/kernel/value-objects/Quantity.ts| | yes / no |
| v04-framework-in-domain | violation |  | FF-DT04|src/billing/kernel/invoice/value-objects/InvoiceId.ts|class-transformer | yes / no |
| v05-event-outside-domain | violation |  |  | yes / no |
| v06-fat-application-service | violation |  |  | yes / no |
| v07-module-outside-context | violation |  | FF-DS01|src/utils/formatCurrency.ts| | yes / no |
| v08-cross-context-internal-import | violation |  | FF-DS02|src/billing/orchestration/IssueInvoice.ts|src/ordering/kernel/order/Order.ts | yes / no |
| v09-domain-imports-application | violation | FF-S02|{src/ordering/kernel/customer/Customer.ts,src/ordering/kernel/customer/CustomerRepository.ts,src/ordering/orchestration/PlaceOrder.ts} | FF-S01|src/ordering/kernel/customer/Customer.ts|src/ordering/orchestration/PlaceOrder.ts | yes / no |
| v10-api-imports-infrastructure | violation |  |  | yes / no |
