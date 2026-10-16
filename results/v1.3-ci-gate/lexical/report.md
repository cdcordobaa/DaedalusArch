# CI gate on synthetic diffs (lexical engine, 71 reference variants)

A case is **exact** when the gate reports precisely the manifest's blocking findings on the expected side (NEW for clean→variant, FIXED for variant→clean) and nothing blocking on the other side; a drift case (every source file shifted by two comment lines) is exact when nothing at all, in any tier, is new or fixed. TP/FN/FP count blocking findings; FP includes rows on the wrong side.

| Style | Direction | Cases | Exact | Expected | TP | FN | FP | Recall | Precision |
|---|---|---|---|---|---|---|---|---|---|
| clean-architecture | clean→variant | 13 | 10/13 (76.9 %) | 13 | 10 | 3 | 0 | 76.9 % | 100.0 % |
| clean-architecture | variant→clean | 13 | 10/13 (76.9 %) | 13 | 10 | 3 | 0 | 76.9 % | 100.0 % |
| clean-architecture | clean→drift | 1 | 1/1 (100.0 %) | 0 | 0 | 0 | 0 | n/a | n/a |
| clean-architecture | variant→drift | 13 | 13/13 (100.0 %) | 0 | 0 | 0 | 0 | n/a | n/a |
| layered | clean→variant | 12 | 10/12 (83.3 %) | 11 | 9 | 2 | 0 | 81.8 % | 100.0 % |
| layered | variant→clean | 12 | 10/12 (83.3 %) | 11 | 9 | 2 | 0 | 81.8 % | 100.0 % |
| layered | clean→drift | 1 | 1/1 (100.0 %) | 0 | 0 | 0 | 0 | n/a | n/a |
| layered | variant→drift | 12 | 12/12 (100.0 %) | 0 | 0 | 0 | 0 | n/a | n/a |
| nestjs | clean→variant | 13 | 10/13 (76.9 %) | 11 | 8 | 3 | 0 | 72.7 % | 100.0 % |
| nestjs | variant→clean | 13 | 10/13 (76.9 %) | 11 | 8 | 3 | 0 | 72.7 % | 100.0 % |
| nestjs | clean→drift | 1 | 1/1 (100.0 %) | 0 | 0 | 0 | 0 | n/a | n/a |
| nestjs | variant→drift | 13 | 13/13 (100.0 %) | 0 | 0 | 0 | 0 | n/a | n/a |
| hexagonal | clean→variant | 14 | 6/14 (42.9 %) | 13 | 1 | 12 | 0 | 7.7 % | 100.0 % |
| hexagonal | variant→clean | 14 | 6/14 (42.9 %) | 13 | 1 | 12 | 0 | 7.7 % | 100.0 % |
| hexagonal | clean→drift | 1 | 1/1 (100.0 %) | 0 | 0 | 0 | 0 | n/a | n/a |
| hexagonal | variant→drift | 14 | 14/14 (100.0 %) | 0 | 0 | 0 | 0 | n/a | n/a |
| ddd | clean→variant | 14 | 6/14 (42.9 %) | 9 | 1 | 8 | 0 | 11.1 % | 100.0 % |
| ddd | variant→clean | 14 | 6/14 (42.9 %) | 9 | 1 | 8 | 0 | 11.1 % | 100.0 % |
| ddd | clean→drift | 1 | 1/1 (100.0 %) | 0 | 0 | 0 | 0 | n/a | n/a |
| ddd | variant→drift | 14 | 14/14 (100.0 %) | 0 | 0 | 0 | 0 | n/a | n/a |
| **all** | clean→variant | 66 | 42/66 (63.6 %) | 57 | 29 | 28 | 0 | 50.9 % | 100.0 % |
| **all** | variant→clean | 66 | 42/66 (63.6 %) | 57 | 29 | 28 | 0 | 50.9 % | 100.0 % |
| **all** | clean→drift | 5 | 5/5 (100.0 %) | 0 | 0 | 0 | 0 | n/a | n/a |
| **all** | variant→drift | 66 | 66/66 (100.0 %) | 0 | 0 | 0 | 0 | n/a | n/a |
| **all** | **all** | 203 | 155/203 (76.4 %) | 114 | 58 | 56 | 0 | 50.9 % | 100.0 % |

Variants with every case exact: **47/71**.

Line drift: across the 71 drift cases, 31 findings were matched as unchanged, 31 of them reported on a different line in head than in base.

## Inexact cases

| Style | Variant | Direction | Missed | Unexpected / wrong side |
|---|---|---|---|---|
| clean-architecture | v03-domain-entity-cycle | clean→variant | FF-S02 `src/domain/entities/Loan.ts` → `src/domain/entities/Member.ts` | - |
| clean-architecture | v03-domain-entity-cycle | variant→clean | FF-S02 `src/domain/entities/Loan.ts` → `src/domain/entities/Member.ts` | - |
| clean-architecture | v06-repository-without-port | clean→variant | FF-P03 `src/infrastructure/persistence/InMemoryLoanRepository.ts` | - |
| clean-architecture | v06-repository-without-port | variant→clean | FF-P03 `src/infrastructure/persistence/InMemoryLoanRepository.ts` | - |
| clean-architecture | v08-domain-service-holds-infrastructure-clock | clean→variant | FF-P06 `src/domain/services/LoanPolicy.ts` → `src/infrastructure/system/SystemClock.ts` | - |
| clean-architecture | v08-domain-service-holds-infrastructure-clock | variant→clean | FF-P06 `src/domain/services/LoanPolicy.ts` → `src/infrastructure/system/SystemClock.ts` | - |
| layered | v05-business-model-cycle | clean→variant | FF-S02 `src/business/model/Customer.ts` → `src/business/model/Order.ts` | - |
| layered | v05-business-model-cycle | variant→clean | FF-S02 `src/business/model/Customer.ts` → `src/business/model/Order.ts` | - |
| layered | v06-router-controller-cycle | clean→variant | FF-S02 `src/presentation/Router.ts` → `src/presentation/http/OrderController.ts` | - |
| layered | v06-router-controller-cycle | variant→clean | FF-S02 `src/presentation/Router.ts` → `src/presentation/http/OrderController.ts` | - |
| nestjs | v04-response-dto-cycle | clean→variant | FF-S02 `src/registrations/dto/registration-response.dto.ts` → `src/workshops/dto/workshop-response.dto.ts` | - |
| nestjs | v04-response-dto-cycle | variant→clean | FF-S02 `src/registrations/dto/registration-response.dto.ts` → `src/workshops/dto/workshop-response.dto.ts` | - |
| nestjs | v08-repository-without-port | clean→variant | FF-P03 `src/attendees/in-memory-attendee.repository.ts` | - |
| nestjs | v08-repository-without-port | variant→clean | FF-P03 `src/attendees/in-memory-attendee.repository.ts` | - |
| nestjs | v10-domain-policy-holds-repository | clean→variant | FF-P06 `src/domain/registration-policy.ts` → `src/registrations/in-memory-registration.repository.ts` | - |
| nestjs | v10-domain-policy-holds-repository | variant→clean | FF-P06 `src/domain/registration-policy.ts` → `src/registrations/in-memory-registration.repository.ts` | - |
| hexagonal | v01-domain-uses-outbound-adapter-constant | clean→variant | FF-S01 `src/domain/services/PriceCalculator.ts` → `src/adapters/outbound/payment/FakePaymentGateway.ts`<br>FF-S04 `src/domain/services/PriceCalculator.ts` → `src/adapters/outbound/payment/FakePaymentGateway.ts` | - |
| hexagonal | v01-domain-uses-outbound-adapter-constant | variant→clean | FF-S01 `src/domain/services/PriceCalculator.ts` → `src/adapters/outbound/payment/FakePaymentGateway.ts`<br>FF-S04 `src/domain/services/PriceCalculator.ts` → `src/adapters/outbound/payment/FakePaymentGateway.ts` | - |
| hexagonal | v02-domain-entity-uses-driven-port | clean→variant | FF-S01 `src/domain/model/Booking.ts` → `src/application/ports/out/NotificationSender.ts`<br>FF-S04 `src/domain/model/Booking.ts` → `src/application/ports/out/NotificationSender.ts` | - |
| hexagonal | v02-domain-entity-uses-driven-port | variant→clean | FF-S01 `src/domain/model/Booking.ts` → `src/application/ports/out/NotificationSender.ts`<br>FF-S04 `src/domain/model/Booking.ts` → `src/application/ports/out/NotificationSender.ts` | - |
| hexagonal | v03-use-case-injects-concrete-adapter | clean→variant | FF-S01 `src/application/services/FindAvailableRoomsService.ts` → `src/adapters/outbound/persistence/InMemoryRoomRepository.ts` | - |
| hexagonal | v03-use-case-injects-concrete-adapter | variant→clean | FF-S01 `src/application/services/FindAvailableRoomsService.ts` → `src/adapters/outbound/persistence/InMemoryRoomRepository.ts` | - |
| hexagonal | v04-use-case-throws-http-error | clean→variant | FF-S01 `src/application/services/CancelBookingService.ts` → `src/adapters/inbound/http/HttpTypes.ts` | - |
| hexagonal | v04-use-case-throws-http-error | variant→clean | FF-S01 `src/application/services/CancelBookingService.ts` → `src/adapters/inbound/http/HttpTypes.ts` | - |
| hexagonal | v08-adapter-without-port | clean→variant | FF-P03 `src/adapters/outbound/payment/FakePaymentGateway.ts` | - |
| hexagonal | v08-adapter-without-port | variant→clean | FF-P03 `src/adapters/outbound/payment/FakePaymentGateway.ts` | - |
| hexagonal | v09-adapter-implements-local-interface | clean→variant | FF-P03 `src/adapters/outbound/persistence/InMemoryRoomRepository.ts` | - |
| hexagonal | v09-adapter-implements-local-interface | variant→clean | FF-P03 `src/adapters/outbound/persistence/InMemoryRoomRepository.ts` | - |
| hexagonal | v10-domain-service-holds-adapter | clean→variant | FF-S01 `src/domain/services/AvailabilityChecker.ts` → `src/adapters/outbound/persistence/InMemoryBookingRepository.ts`<br>FF-S04 `src/domain/services/AvailabilityChecker.ts` → `src/adapters/outbound/persistence/InMemoryBookingRepository.ts`<br>FF-P06 `src/domain/services/AvailabilityChecker.ts` → `src/adapters/outbound/persistence/InMemoryBookingRepository.ts` | - |
| hexagonal | v10-domain-service-holds-adapter | variant→clean | FF-S01 `src/domain/services/AvailabilityChecker.ts` → `src/adapters/outbound/persistence/InMemoryBookingRepository.ts`<br>FF-S04 `src/domain/services/AvailabilityChecker.ts` → `src/adapters/outbound/persistence/InMemoryBookingRepository.ts`<br>FF-P06 `src/domain/services/AvailabilityChecker.ts` → `src/adapters/outbound/persistence/InMemoryBookingRepository.ts` | - |
| hexagonal | v11-domain-model-cycle | clean→variant | FF-S02 `src/domain/model/Booking.ts` → `src/domain/model/Room.ts` | - |
| hexagonal | v11-domain-model-cycle | variant→clean | FF-S02 `src/domain/model/Booking.ts` → `src/domain/model/Room.ts` | - |
| ddd | g01-value-object-setter-accessor | clean→variant | FF-DT03 `src/ordering/domain/value-objects/Quantity.ts` | - |
| ddd | g01-value-object-setter-accessor | variant→clean | FF-DT03 `src/ordering/domain/value-objects/Quantity.ts` | - |
| ddd | g03-deep-import-of-reexported-file | clean→variant | FF-DS02 `src/billing/api/InvoiceController.ts` → `src/ordering/application/GetOrderSummary.ts` | - |
| ddd | g03-deep-import-of-reexported-file | variant→clean | FF-DS02 `src/billing/api/InvoiceController.ts` → `src/ordering/application/GetOrderSummary.ts` | - |
| ddd | v01-aggregate-boundary | clean→variant | FF-DT01 `src/ordering/application/GetOrderSummary.ts` → `src/ordering/domain/order/OrderLine.ts` | - |
| ddd | v01-aggregate-boundary | variant→clean | FF-DT01 `src/ordering/application/GetOrderSummary.ts` → `src/ordering/domain/order/OrderLine.ts` | - |
| ddd | v02-repository-for-inner-entity | clean→variant | FF-DT02 `src/ordering/domain/order/OrderLineRepository.ts` → `src/ordering/domain/order/OrderLine.ts` | - |
| ddd | v02-repository-for-inner-entity | variant→clean | FF-DT02 `src/ordering/domain/order/OrderLineRepository.ts` → `src/ordering/domain/order/OrderLine.ts` | - |
| ddd | v03-mutable-value-object | clean→variant | FF-DT03 `src/ordering/domain/value-objects/Quantity.ts` | - |
| ddd | v03-mutable-value-object | variant→clean | FF-DT03 `src/ordering/domain/value-objects/Quantity.ts` | - |
| ddd | v07-module-outside-context | clean→variant | FF-DS01 `src/utils/formatCurrency.ts` | - |
| ddd | v07-module-outside-context | variant→clean | FF-DS01 `src/utils/formatCurrency.ts` | - |
| ddd | v08-cross-context-internal-import | clean→variant | FF-DS02 `src/billing/application/IssueInvoice.ts` → `src/ordering/domain/order/Order.ts` | - |
| ddd | v08-cross-context-internal-import | variant→clean | FF-DS02 `src/billing/application/IssueInvoice.ts` → `src/ordering/domain/order/Order.ts` | - |
| ddd | v09-domain-imports-application | clean→variant | FF-S01 `src/ordering/domain/customer/Customer.ts` → `src/ordering/application/PlaceOrder.ts` | - |
| ddd | v09-domain-imports-application | variant→clean | FF-S01 `src/ordering/domain/customer/Customer.ts` → `src/ordering/application/PlaceOrder.ts` | - |
