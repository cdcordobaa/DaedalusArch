# Fix-hint validity on the v1.3 development set (71 variants)

True blocking findings: manifest findings the run matches whose rule is blocking under the v1.3 tiers for the style. Valid = the target is allowed by the spec AND the simulated edit removes the finding from its own rule. "No regression" also requires that no other blocking finding appears after the edit. CLI = `firewall evaluate --hints` (graph + spec); MCP = the spec-only hint `check_file`/`check_diff` build.

Control 1: the unedited graph reproduces 57/57 (100%) of the findings (an edit can only count as removing a finding that the re-run first reports).

Control 2 (wrong-layer mutants): the CLI hint with its new or moved file put next to the violating target instead is rejected (invalid or with a regression) in 19/19 (100%) of the applicable cases; by the spec check alone in 15/19 (79%).

Overall: CLI valid 57/57 (100%), no regression 57/57 (100%); MCP (spec-only) valid 57/57 (100%), no regression 57/57 (100%).

| Style | Rule | Name | True blocking | CLI hinted | CLI target ok | CLI edge removed | CLI valid | CLI no regression | MCP valid | MCP no regression |
|---|---|---|---|---|---|---|---|---|---|---|
| clean-architecture | FF-S01 | dependency-direction | 5 | 5 | 5 | 5 | 5/5 (100%) | 5/5 (100%) | 5/5 (100%) | 5/5 (100%) |
| clean-architecture | FF-S04 | no-domain-outward-dep | 3 | 3 | 3 | 3 | 3/3 (100%) | 3/3 (100%) | 3/3 (100%) | 3/3 (100%) |
| clean-architecture | FF-S02 | no-cyclic-deps | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| clean-architecture | FF-P01 | domain-purity | 2 | 2 | 2 | 2 | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) |
| clean-architecture | FF-P03 | repository-pattern | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| clean-architecture | FF-P06 | domain-state-purity | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| layered | FF-S01 | dependency-direction | 2 | 2 | 2 | 2 | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) |
| layered | FF-S03 | no-layer-skip | 5 | 5 | 5 | 5 | 5/5 (100%) | 5/5 (100%) | 5/5 (100%) | 5/5 (100%) |
| layered | FF-S02 | no-cyclic-deps | 2 | 2 | 2 | 2 | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) |
| layered | FF-P01 | domain-purity | 2 | 2 | 2 | 2 | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) |
| nestjs | FF-S01 | dependency-direction | 4 | 4 | 4 | 4 | 4/4 (100%) | 4/4 (100%) | 4/4 (100%) | 4/4 (100%) |
| nestjs | FF-S04 | no-domain-outward-dep | 2 | 2 | 2 | 2 | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) |
| nestjs | FF-S02 | no-cyclic-deps | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| nestjs | FF-P01 | domain-purity | 2 | 2 | 2 | 2 | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) |
| nestjs | FF-P03 | repository-pattern | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| nestjs | FF-P06 | domain-state-purity | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| hexagonal | FF-S01 | dependency-direction-graph | 5 | 5 | 5 | 5 | 5/5 (100%) | 5/5 (100%) | 5/5 (100%) | 5/5 (100%) |
| hexagonal | FF-S04 | core-isolation | 3 | 3 | 3 | 3 | 3/3 (100%) | 3/3 (100%) | 3/3 (100%) | 3/3 (100%) |
| hexagonal | FF-P01 | domain-purity | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| hexagonal | FF-P03 | port-adapter-pattern | 2 | 2 | 2 | 2 | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) |
| hexagonal | FF-P06 | domain-state-purity | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| hexagonal | FF-S02 | no-cyclic-deps | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| ddd | FF-DT03 | value-object-immutability | 2 | 2 | 2 | 2 | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) |
| ddd | FF-DS02 | context-isolation | 2 | 2 | 2 | 2 | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) |
| ddd | FF-DT01 | aggregate-boundary | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| ddd | FF-DT02 | repository-aggregate-root | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| ddd | FF-DT04 | domain-purity | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| ddd | FF-DS01 | bounded-context-modules | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |
| ddd | FF-S01 | dependency-direction-graph | 1 | 1 | 1 | 1 | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) |

## Per finding

| Style | Variant | Rule | File | CLI action | CLI target | CLI valid | Regressions (CLI) | Notes |
|---|---|---|---|---|---|---|---|---|
| clean-architecture | v01-domain-imports-application-port | FF-S01 | src/domain/entities/Loan.ts | move-file | src/domain/entities/Clock.ts | yes | - | - |
| clean-architecture | v01-domain-imports-application-port | FF-S04 | src/domain/entities/Loan.ts | move-file | src/domain/entities/Clock.ts | yes | - | - |
| clean-architecture | v02-domain-uses-infrastructure-clock | FF-S01 | src/domain/services/LoanPolicy.ts | move-file | src/domain/services/Clock.ts | yes | - | - |
| clean-architecture | v02-domain-uses-infrastructure-clock | FF-S04 | src/domain/services/LoanPolicy.ts | move-file | src/domain/services/Clock.ts | yes | - | - |
| clean-architecture | v03-domain-entity-cycle | FF-S02 | src/domain/entities/Loan.ts | break-cycle | src/domain/entities/LoanContract.ts | yes | - | - |
| clean-architecture | v04-domain-entity-typeorm-decorator | FF-P01 | src/domain/entities/Book.ts | extract-adapter | src/infrastructure/BookRecord.ts | yes | - | - |
| clean-architecture | v05-use-case-injects-concrete-repository | FF-S01 | src/application/use-cases/RegisterBookUseCase.ts | use-existing-port | src/domain/repositories/BookRepository.ts | yes | - | - |
| clean-architecture | v06-repository-without-port | FF-P03 | src/infrastructure/persistence/InMemoryLoanRepository.ts | implement-port | src/domain/repositories/LoanRepository.ts | yes | - | - |
| clean-architecture | v08-domain-service-holds-infrastructure-clock | FF-S01 | src/domain/services/LoanPolicy.ts | move-file | src/domain/services/Clock.ts | yes | - | - |
| clean-architecture | v08-domain-service-holds-infrastructure-clock | FF-S04 | src/domain/services/LoanPolicy.ts | move-file | src/domain/services/Clock.ts | yes | - | - |
| clean-architecture | v08-domain-service-holds-infrastructure-clock | FF-P06 | src/domain/services/LoanPolicy.ts | move-file | src/domain/services/Clock.ts | yes | - | - |
| clean-architecture | v09-dto-depends-on-http-adapter | FF-S01 | src/application/dto/LoanDto.ts | move-declaration | src/application/dto/HttpResponse.ts | yes | - | - |
| clean-architecture | v10-domain-entity-type-imports-express | FF-P01 | src/domain/entities/Member.ts | replace-with-own-type | src/domain/entities/MemberInput.ts | yes | - | - |
| layered | v01-gateway-returns-business-money | FF-S01 | src/persistence/ProductGateway.ts | lift-to-caller | src/business/services/CatalogService.ts | yes | - | - |
| layered | v01-gateway-returns-business-money | FF-S03 | src/persistence/ProductGateway.ts | lift-to-caller | src/business/services/CatalogService.ts | yes | - | - |
| layered | v02-service-renders-view | FF-S01 | src/business/services/OrderService.ts | lift-to-caller | src/presentation/http/OrderController.ts | yes | - | - |
| layered | v02-service-renders-view | FF-S03 | src/business/services/OrderService.ts | lift-to-caller | src/presentation/http/OrderController.ts | yes | - | - |
| layered | v03-controller-reads-gateway | FF-S03 | src/presentation/http/CatalogController.ts | route-through | src/business/services/CatalogService.ts | yes | - | - |
| layered | v04-view-types-persistence-record | FF-S03 | src/presentation/views/ProductView.ts | route-through | src/business/model/Product.ts | yes | - | - |
| layered | v05-business-model-cycle | FF-S02 | src/business/model/Customer.ts | break-cycle | src/business/model/CustomerContract.ts | yes | - | - |
| layered | v06-router-controller-cycle | FF-S02 | src/presentation/Router.ts | break-cycle | src/presentation/http/RouterContract.ts | yes | - | - |
| layered | v07-business-model-typeorm-decorator | FF-P01 | src/business/model/Order.ts | extract-adapter | src/persistence/OrderRecord.ts | yes | - | - |
| layered | v08-business-service-takes-express-request | FF-P01 | src/business/services/OrderService.ts | replace-with-own-type | src/business/services/OrderServiceInput.ts | yes | - | - |
| layered | v09-presentation-root-builds-database | FF-S03 | src/presentation/app.ts | route-through | src/business/ServiceFactory.ts | yes | - | - |
| nestjs | v01-domain-entity-imports-dto | FF-S01 | src/domain/registration.ts | move-declaration | src/domain/register-attendee-data.ts | yes | - | - |
| nestjs | v01-domain-entity-imports-dto | FF-S04 | src/domain/registration.ts | move-declaration | src/domain/register-attendee-data.ts | yes | - | - |
| nestjs | v02-repository-builds-response-dto | FF-S01 | src/workshops/in-memory-workshop.repository.ts | lift-to-caller | src/workshops/dto/in-memory-workshop-repository-mapper.ts | yes | - | - |
| nestjs | v03-service-imports-guard | FF-S01 | src/registrations/registrations.service.ts | lift-to-caller | src/registrations/registrations.controller.ts | yes | - | - |
| nestjs | v04-response-dto-cycle | FF-S02 | src/registrations/dto/registration-response.dto.ts | break-cycle | src/workshops/dto/registration-response-dto-contract.ts | yes | - | - |
| nestjs | v05-domain-entity-typeorm-decorator | FF-P01 | src/domain/workshop.ts | extract-adapter | src/infrastructure/workshop-record.ts | yes | - | - |
| nestjs | v06-domain-entity-type-imports-express | FF-P01 | src/domain/attendee.ts | replace-with-own-type | src/domain/attendee-input.ts | yes | - | - |
| nestjs | v08-repository-without-port | FF-P03 | src/attendees/in-memory-attendee.repository.ts | implement-port | src/domain/attendee-repository.ts | yes | - | - |
| nestjs | v10-domain-policy-holds-repository | FF-S01 | src/domain/registration-policy.ts | use-existing-port | src/domain/registration-repository.ts | yes | - | - |
| nestjs | v10-domain-policy-holds-repository | FF-S04 | src/domain/registration-policy.ts | use-existing-port | src/domain/registration-repository.ts | yes | - | - |
| nestjs | v10-domain-policy-holds-repository | FF-P06 | src/domain/registration-policy.ts | use-existing-port | src/domain/registration-repository.ts | yes | - | - |
| hexagonal | v01-domain-uses-outbound-adapter-constant | FF-S01 | src/domain/services/PriceCalculator.ts | move-declaration | src/domain/services/paymentFeeCents.ts | yes | - | - |
| hexagonal | v01-domain-uses-outbound-adapter-constant | FF-S04 | src/domain/services/PriceCalculator.ts | move-declaration | src/domain/services/paymentFeeCents.ts | yes | - | - |
| hexagonal | v02-domain-entity-uses-driven-port | FF-S01 | src/domain/model/Booking.ts | move-file | src/domain/model/NotificationSender.ts | yes | - | - |
| hexagonal | v02-domain-entity-uses-driven-port | FF-S04 | src/domain/model/Booking.ts | move-file | src/domain/model/NotificationSender.ts | yes | - | - |
| hexagonal | v03-use-case-injects-concrete-adapter | FF-S01 | src/application/services/FindAvailableRoomsService.ts | use-existing-port | src/application/ports/out/RoomRepository.ts | yes | - | - |
| hexagonal | v04-use-case-throws-http-error | FF-S01 | src/application/services/CancelBookingService.ts | lift-to-caller | src/adapters/inbound/http/CancelBookingServicePresenter.ts | yes | - | - |
| hexagonal | v07-domain-service-nestjs-decorator | FF-P01 | src/domain/services/AvailabilityChecker.ts | extract-adapter | src/config/AvailabilityCheckerProvider.ts | yes | - | - |
| hexagonal | v08-adapter-without-port | FF-P03 | src/adapters/outbound/payment/FakePaymentGateway.ts | implement-port | src/application/ports/out/PaymentGateway.ts | yes | - | - |
| hexagonal | v09-adapter-implements-local-interface | FF-P03 | src/adapters/outbound/persistence/InMemoryRoomRepository.ts | move-file | src/application/ports/out/RoomStore.ts | yes | - | - |
| hexagonal | v10-domain-service-holds-adapter | FF-S01 | src/domain/services/AvailabilityChecker.ts | move-file | src/domain/services/BookingRepository.ts | yes | - | - |
| hexagonal | v10-domain-service-holds-adapter | FF-S04 | src/domain/services/AvailabilityChecker.ts | move-file | src/domain/services/BookingRepository.ts | yes | - | - |
| hexagonal | v10-domain-service-holds-adapter | FF-P06 | src/domain/services/AvailabilityChecker.ts | move-file | src/domain/services/BookingRepository.ts | yes | - | - |
| hexagonal | v11-domain-model-cycle | FF-S02 | src/domain/model/Booking.ts | break-cycle | src/domain/model/BookingContract.ts | yes | - | - |
| ddd | g01-value-object-setter-accessor | FF-DT03 | src/ordering/domain/value-objects/Quantity.ts | make-immutable | src/ordering/domain/value-objects/Quantity.ts | yes | - | - |
| ddd | g03-deep-import-of-reexported-file | FF-DS02 | src/billing/api/InvoiceController.ts | use-public-api | src/ordering/index.ts | yes | - | - |
| ddd | v01-aggregate-boundary | FF-DT01 | src/ordering/application/GetOrderSummary.ts | reference-root | src/ordering/domain/order/Order.ts | yes | - | - |
| ddd | v02-repository-for-inner-entity | FF-DT02 | src/ordering/domain/order/OrderLineRepository.ts | remove-repository | src/ordering/domain/order/OrderRepository.ts | yes | - | - |
| ddd | v03-mutable-value-object | FF-DT03 | src/ordering/domain/value-objects/Quantity.ts | make-immutable | src/ordering/domain/value-objects/Quantity.ts | yes | - | - |
| ddd | v04-framework-in-domain | FF-DT04 | src/billing/domain/invoice/value-objects/InvoiceId.ts | extract-adapter | src/billing/infrastructure/InvoiceIdRecord.ts | yes | - | - |
| ddd | v07-module-outside-context | FF-DS01 | src/utils/formatCurrency.ts | move-file | src/billing/domain/formatCurrency.ts | yes | - | - |
| ddd | v08-cross-context-internal-import | FF-DS02 | src/billing/application/IssueInvoice.ts | use-public-api | src/ordering/index.ts | yes | - | - |
| ddd | v09-domain-imports-application | FF-S01 | src/ordering/domain/customer/Customer.ts | move-declaration | src/ordering/domain/customer/PlaceOrderCommand.ts | yes | - | - |
