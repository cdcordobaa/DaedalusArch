# v1.3 metamorphic run: summary

Untransformed variants: 71; type-check clean: 71; cypher-interp rows identical to the committed Neo4j run (after-member-facts): 71/71.

Invariance: the defining-rule verdict and the set of blocking (rule, layer pair) keys are unchanged. "Files" is stricter: the set of blocking (rule, file, target) keys after mapping renamed, split and merged files is unchanged too.

| transformation | variants | n/a | no candidate | evaluated | invariant | rate [95% Wilson] | files-invariant | defining verdict changed | tool verdict changed | advisory changed |
|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|
| rename | 71 | 0 | 0 | 71 | 71 | 1.000 [0.95, 1.00] | 71 | 0 | 0 | 0 |
| reorder | 71 | 0 | 0 | 71 | 71 | 1.000 [0.95, 1.00] | 71 | 0 | 0 | 0 |
| reformat | 71 | 0 | 0 | 71 | 71 | 1.000 [0.95, 1.00] | 71 | 0 | 0 | 0 |
| barrel-add | 71 | 0 | 0 | 71 | 67 | 0.944 [0.86, 0.98] | 46 | 1 | 0 | 56 |
| barrel-remove | 71 | 55 | 0 | 16 | 15 | 0.938 [0.72, 0.99] | 15 | 1 | 1 | 0 |
| default-export | 71 | 0 | 0 | 71 | 71 | 1.000 [0.95, 1.00] | 71 | 0 | 0 | 0 |
| import-type | 71 | 0 | 0 | 71 | 71 | 1.000 [0.95, 1.00] | 71 | 0 | 0 | 0 |
| path-alias | 71 | 0 | 0 | 71 | 71 | 1.000 [0.95, 1.00] | 71 | 0 | 0 | 0 |
| split | 71 | 0 | 0 | 71 | 71 | 1.000 [0.95, 1.00] | 71 | 0 | 0 | 12 |
| merge | 71 | 0 | 0 | 71 | 58 | 0.817 [0.71, 0.89] | 57 | 8 | 10 | 16 |
| rename-opaque (probe) | 71 | 0 | 0 | 71 | 61 | 0.859 [0.76, 0.92] | 61 | 10 | 8 | 17 |
| rename-spec-stale (probe) | 71 | 0 | 0 | 71 | 68 | 0.958 [0.88, 0.99] | 68 | 3 | 2 | 1 |
| import-type-drop (probe) | 71 | 51 | 0 | 20 | 20 | 1.000 [0.84, 1.00] | 20 | 0 | 0 | 0 |

## Per rule (cases where the rule changed / evaluated cases)

| rule | involved | rename | reorder | reformat | barrel-add | barrel-remove | default-export | import-type | path-alias | split | merge | rename-opaque | rename-spec-stale | import-type-drop |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| FF-DS01 | 13 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 |
| FF-DS02 | 27 | 0/15 | 0/15 | 0/15 | 0/15 | **1**/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 |
| FF-DT01 | 13 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | **1**/15 | 0/15 |
| FF-DT02 | 13 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | **1**/15 | **1**/15 | 0/15 |
| FF-DT03 | 26 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 |
| FF-DT04 | 13 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 |
| FF-P01 | 80 | 0/56 | 0/56 | 0/56 | 0/56 | 0/1 | 0/56 | 0/56 | 0/56 | 0/56 | 0/56 | 0/56 | 0/56 | 0/5 |
| FF-P03 | 44 | 0/43 | 0/43 | 0/43 | 0/43 |  | 0/43 | 0/43 | 0/43 | 0/43 | 0/43 | **4**/43 | 0/43 | 0/3 |
| FF-P06 | 33 | 0/43 | 0/43 | 0/43 | 0/43 |  | 0/43 | 0/43 | 0/43 | 0/43 | 0/43 | **1**/43 | 0/43 | 0/3 |
| FF-S01 | 189 | 0/71 | 0/71 | 0/71 | **1**/71 | 0/16 | 0/71 | 0/71 | 0/71 | 0/71 | 0/71 | **3**/71 | 0/71 | 0/20 |
| FF-S02 | 72 | 0/56 | 0/56 | 0/56 | **4**/56 | 0/1 | 0/56 | 0/56 | 0/56 | 0/56 | **13**/56 | 0/56 | 0/56 | 0/5 |
| FF-S03 | 56 | 0/13 | 0/13 | 0/13 | 0/13 | 0/1 | 0/13 | 0/13 | 0/13 | 0/13 | 0/13 | 0/13 | 0/13 | 0/2 |
| FF-S04 | 88 | 0/43 | 0/43 | 0/43 | **1**/43 |  | 0/43 | 0/43 | 0/43 | 0/43 | 0/43 | **1**/43 | 0/43 | 0/3 |

## Cases that are not invariant

- **barrel-add clean-architecture/v01-domain-imports-application-port** (violation; one export-star barrel per directory) layer-pair invariant, files differ
  - lost (rule, file, target): FF-S01|src/domain/entities/Loan.ts|src/application/ports/Clock.ts; FF-S04|src/domain/entities/Loan.ts|src/application/ports/Clock.ts
  - gained (rule, file, target): FF-S01|src/domain/entities/Loan.ts|src/application/ports/index.ts; FF-S04|src/domain/entities/Loan.ts|src/application/ports/index.ts
- **barrel-add clean-architecture/v02-domain-uses-infrastructure-clock** (violation; one export-star barrel per directory) layer-pair invariant, files differ
  - lost (rule, file, target): FF-S01|src/domain/services/LoanPolicy.ts|src/infrastructure/system/SystemClock.ts; FF-S04|src/domain/services/LoanPolicy.ts|src/infrastructure/system/SystemClock.ts
  - gained (rule, file, target): FF-S01|src/domain/services/LoanPolicy.ts|src/infrastructure/system/index.ts; FF-S04|src/domain/services/LoanPolicy.ts|src/infrastructure/system/index.ts
- **barrel-add clean-architecture/v05-use-case-injects-concrete-repository** (violation; one export-star barrel per directory) layer-pair invariant, files differ
  - lost (rule, file, target): FF-S01|src/application/use-cases/RegisterBookUseCase.ts|src/infrastructure/persistence/InMemoryBookRepository.ts
  - gained (rule, file, target): FF-S01|src/application/use-cases/RegisterBookUseCase.ts|src/infrastructure/persistence/index.ts
- **barrel-add clean-architecture/v08-domain-service-holds-infrastructure-clock** (violation; one export-star barrel per directory) layer-pair invariant, files differ
  - lost (rule, file, target): FF-S01|src/domain/services/LoanPolicy.ts|src/infrastructure/system/SystemClock.ts; FF-S04|src/domain/services/LoanPolicy.ts|src/infrastructure/system/SystemClock.ts
  - gained (rule, file, target): FF-S01|src/domain/services/LoanPolicy.ts|src/infrastructure/system/index.ts; FF-S04|src/domain/services/LoanPolicy.ts|src/infrastructure/system/index.ts
- **barrel-add clean-architecture/v09-dto-depends-on-http-adapter** (violation; one export-star barrel per directory) NOT INVARIANT
  - gained (rule, layer pair): FF-S02|{application,infrastructure}
  - lost (rule, file, target): FF-S01|src/application/dto/LoanDto.ts|src/infrastructure/http/HttpTypes.ts
  - gained (rule, file, target): FF-S01|src/application/dto/LoanDto.ts|src/infrastructure/http/index.ts; FF-S02|{src/application/dto/LoanDto.ts,src/application/dto/index.ts,src/application/use-cases/BorrowBookUseCase.ts,src/application/use-cases/index.ts,src/infrastructure/http/BookController.ts,src/infrastructure/http/index.ts}; FF-S02|{src/application/dto/LoanDto.ts,src/application/dto/index.ts,src/application/use-cases/BorrowBookUseCase.ts,src/application/use-cases/index.ts,src/infrastructure/http/LoanController.ts,src/infrastructure/http/index.ts}; FF-S02|{src/application/dto/LoanDto.ts,src/application/dto/index.ts,src/application/use-cases/ListOverdueLoansUseCase.ts,src/application/use-cases/index.ts,src/infrastructure/http/BookController.ts,src/infrastructure/http/index.ts}; FF-S02|{src/application/dto/LoanDto.ts,src/application/dto/index.ts,src/application/use-cases/ListOverdueLoansUseCase.ts,src/application/use-cases/index.ts,src/infrastructure/http/LoanController.ts,src/infrastructure/http/index.ts}; FF-S02|{src/application/dto/LoanDto.ts,src/application/dto/index.ts,src/application/use-cases/RegisterBookUseCase.ts,src/application/use-cases/index.ts,src/infrastructure/http/BookController.ts,src/infrastructure/http/index.ts}; FF-S02|{src/application/dto/LoanDto.ts,src/application/dto/index.ts,src/application/use-cases/RegisterBookUseCase.ts,src/application/use-cases/index.ts,src/infrastructure/http/LoanController.ts,src/infrastructure/http/index.ts}; FF-S02|{src/application/dto/LoanDto.ts,src/application/dto/index.ts,src/application/use-cases/ReturnBookUseCase.ts,src/application/use-cases/index.ts,src/infrastructure/http/BookController.ts,src/infrastructure/http/index.ts}; FF-S02|{src/application/dto/LoanDto.ts,src/application/dto/index.ts,src/application/use-cases/ReturnBookUseCase.ts,src/application/use-cases/index.ts,src/infrastructure/http/LoanController.ts,src/infrastructure/http/index.ts}
- **barrel-add layered/v01-gateway-returns-business-money** (violation; one export-star barrel per directory) layer-pair invariant, files differ
  - lost (rule, file, target): FF-S01|src/persistence/ProductGateway.ts|src/business/model/Money.ts; FF-S03|src/persistence/ProductGateway.ts|src/business/model/Money.ts
  - gained (rule, file, target): FF-S01|src/persistence/ProductGateway.ts|src/business/model/index.ts; FF-S03|src/persistence/ProductGateway.ts|src/business/model/index.ts
- **barrel-add layered/v02-service-renders-view** (violation; one export-star barrel per directory) layer-pair invariant, files differ
  - lost (rule, file, target): FF-S01|src/business/services/OrderService.ts|src/presentation/views/OrderView.ts; FF-S03|src/business/services/OrderService.ts|src/presentation/views/OrderView.ts
  - gained (rule, file, target): FF-S01|src/business/services/OrderService.ts|src/presentation/views/index.ts; FF-S03|src/business/services/OrderService.ts|src/presentation/views/index.ts
- **barrel-add layered/v03-controller-reads-gateway** (violation; one export-star barrel per directory) layer-pair invariant, files differ
  - lost (rule, file, target): FF-S03|src/presentation/http/CatalogController.ts|src/persistence/ProductGateway.ts
  - gained (rule, file, target): FF-S03|src/presentation/http/CatalogController.ts|src/persistence/index.ts
- **barrel-add layered/v04-view-types-persistence-record** (violation; one export-star barrel per directory) layer-pair invariant, files differ
  - lost (rule, file, target): FF-S03|src/presentation/views/ProductView.ts|src/persistence/records/ProductRecord.ts
  - gained (rule, file, target): FF-S03|src/presentation/views/ProductView.ts|src/persistence/records/index.ts
- **barrel-add layered/v06-router-controller-cycle** (violation; one export-star barrel per directory) layer-pair invariant, files differ
  - lost (rule, file, target): FF-S02|{src/presentation/Router.ts,src/presentation/http/OrderController.ts}
  - gained (rule, file, target): FF-S02|{src/presentation/Router.ts,src/presentation/http/OrderController.ts,src/presentation/http/index.ts}
- **barrel-add layered/v09-presentation-root-builds-database** (violation; one export-star barrel per directory) layer-pair invariant, files differ
  - lost (rule, file, target): FF-S03|src/presentation/app.ts|src/persistence/Database.ts
  - gained (rule, file, target): FF-S03|src/presentation/app.ts|src/persistence/index.ts
- **barrel-add nestjs/v01-domain-entity-imports-dto** (violation; one export-star barrel per directory) NOT INVARIANT
  - gained (rule, layer pair): FF-S02|{application,domain}
  - lost (rule, file, target): FF-S01|src/domain/registration.ts|src/registrations/dto/register-attendee.dto.ts; FF-S04|src/domain/registration.ts|src/registrations/dto/register-attendee.dto.ts
  - gained (rule, file, target): FF-S01|src/domain/registration.ts|src/registrations/dto/index.ts; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/domain/registration.ts,src/registrations/dto/index.ts,src/registrations/dto/registration-response.dto.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-repository.ts,src/domain/registration.ts,src/registrations/dto/index.ts,src/registrations/dto/registration-response.dto.ts}; FF-S02|{src/domain/index.ts,src/domain/registration.ts,src/registrations/dto/index.ts,src/registrations/dto/registration-response.dto.ts}; FF-S04|src/domain/registration.ts|src/registrations/dto/index.ts
- **barrel-add nestjs/v02-repository-builds-response-dto** (violation; one export-star barrel per directory) layer-pair invariant, files differ
  - lost (rule, file, target): FF-S01|src/workshops/in-memory-workshop.repository.ts|src/workshops/dto/workshop-response.dto.ts
  - gained (rule, file, target): FF-S01|src/workshops/in-memory-workshop.repository.ts|src/workshops/dto/index.ts
- **barrel-add nestjs/v03-service-imports-guard** (violation; one export-star barrel per directory) layer-pair invariant, files differ
  - lost (rule, file, target): FF-S01|src/registrations/registrations.service.ts|src/common/guards/api-key.guard.ts
  - gained (rule, file, target): FF-S01|src/registrations/registrations.service.ts|src/common/guards/index.ts
- **barrel-add nestjs/v04-response-dto-cycle** (violation; one export-star barrel per directory) layer-pair invariant, files differ
  - lost (rule, file, target): FF-S02|{src/registrations/dto/registration-response.dto.ts,src/workshops/dto/workshop-response.dto.ts}
  - gained (rule, file, target): FF-S02|{src/registrations/dto/index.ts,src/registrations/dto/registration-response.dto.ts,src/workshops/dto/index.ts,src/workshops/dto/workshop-response.dto.ts}
- **barrel-add nestjs/v10-domain-policy-holds-repository** (violation; one export-star barrel per directory) NOT INVARIANT
  - defining verdict: FF-P06:violated,FF-S01:violated,FF-S04:violated -> FF-P06:violated,FF-S01:clean,FF-S04:clean
  - lost (rule, layer pair): FF-S01|domain>infrastructure; FF-S04|domain>infrastructure
  - gained (rule, layer pair): FF-S02|{?,application,domain,presentation}; FF-S02|{?,application,domain}; FF-S02|{?,domain,infrastructure,presentation}; FF-S02|{?,domain,infrastructure}; FF-S02|{?,domain,presentation}
  - lost (rule, file, target): FF-S01|src/domain/registration-policy.ts|src/registrations/in-memory-registration.repository.ts; FF-S04|src/domain/registration-policy.ts|src/registrations/in-memory-registration.repository.ts
  - gained (rule, file, target): FF-S02|{src/attendees/attendees.controller.ts,src/attendees/attendees.module.ts,src/attendees/attendees.service.ts,src/attendees/index.ts,src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/index.ts,src/registrations/registrations.module.ts}; FF-S02|{src/attendees/attendees.controller.ts,src/attendees/attendees.service.ts,src/attendees/index.ts,src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/index.ts,src/registrations/registrations.module.ts}; FF-S02|{src/attendees/attendees.module.ts,src/attendees/attendees.service.ts,src/attendees/index.ts,src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/index.ts,src/registrations/registrations.module.ts}; FF-S02|{src/attendees/attendees.module.ts,src/attendees/in-memory-attendee.repository.ts,src/attendees/index.ts,src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/index.ts,src/registrations/registrations.module.ts}; FF-S02|{src/attendees/attendees.module.ts,src/attendees/index.ts,src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/index.ts,src/registrations/registrations.module.ts}; FF-S02|{src/attendees/attendees.service.ts,src/attendees/index.ts,src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/index.ts,src/registrations/registrations.module.ts}; FF-S02|{src/attendees/in-memory-attendee.repository.ts,src/attendees/index.ts,src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/index.ts,src/registrations/registrations.module.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/dto/index.ts,src/registrations/dto/registration-response.dto.ts,src/registrations/index.ts,src/registrations/registrations.controller.ts,src/registrations/registrations.module.ts,src/registrations/registrations.service.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/dto/index.ts,src/registrations/dto/registration-response.dto.ts,src/registrations/index.ts,src/registrations/registrations.controller.ts,src/registrations/registrations.module.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/dto/index.ts,src/registrations/dto/registration-response.dto.ts,src/registrations/index.ts,src/registrations/registrations.controller.ts,src/registrations/registrations.service.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/dto/index.ts,src/registrations/dto/registration-response.dto.ts,src/registrations/index.ts,src/registrations/registrations.controller.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/dto/index.ts,src/registrations/dto/registration-response.dto.ts,src/registrations/index.ts,src/registrations/registrations.module.ts,src/registrations/registrations.service.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/dto/index.ts,src/registrations/dto/registration-response.dto.ts,src/registrations/index.ts,src/registrations/registrations.service.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/in-memory-registration.repository.ts,src/registrations/index.ts,src/registrations/registrations.module.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/in-memory-registration.repository.ts,src/registrations/index.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/index.ts,src/registrations/registrations.controller.ts,src/registrations/registrations.module.ts,src/registrations/registrations.service.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/index.ts,src/registrations/registrations.controller.ts,src/registrations/registrations.service.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/index.ts,src/registrations/registrations.module.ts,src/registrations/registrations.service.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/index.ts,src/registrations/registrations.module.ts,src/workshops/dto/index.ts,src/workshops/dto/workshop-response.dto.ts,src/workshops/index.ts,src/workshops/workshops.controller.ts,src/workshops/workshops.module.ts,src/workshops/workshops.service.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/index.ts,src/registrations/registrations.module.ts,src/workshops/dto/index.ts,src/workshops/dto/workshop-response.dto.ts,src/workshops/index.ts,src/workshops/workshops.controller.ts,src/workshops/workshops.module.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/index.ts,src/registrations/registrations.module.ts,src/workshops/dto/index.ts,src/workshops/dto/workshop-response.dto.ts,src/workshops/index.ts,src/workshops/workshops.controller.ts,src/workshops/workshops.service.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/index.ts,src/registrations/registrations.module.ts,src/workshops/dto/index.ts,src/workshops/dto/workshop-response.dto.ts,src/workshops/index.ts,src/workshops/workshops.controller.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/index.ts,src/registrations/registrations.module.ts,src/workshops/dto/index.ts,src/workshops/dto/workshop-response.dto.ts,src/workshops/index.ts,src/workshops/workshops.module.ts,src/workshops/workshops.service.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/index.ts,src/registrations/registrations.module.ts,src/workshops/dto/index.ts,src/workshops/dto/workshop-response.dto.ts,src/workshops/index.ts,src/workshops/workshops.service.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/index.ts,src/registrations/registrations.module.ts,src/workshops/in-memory-workshop.repository.ts,src/workshops/index.ts,src/workshops/workshops.module.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/index.ts,src/registrations/registrations.module.ts,src/workshops/in-memory-workshop.repository.ts,src/workshops/index.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/index.ts,src/registrations/registrations.module.ts,src/workshops/index.ts,src/workshops/workshops.controller.ts,src/workshops/workshops.module.ts,src/workshops/workshops.service.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/index.ts,src/registrations/registrations.module.ts,src/workshops/index.ts,src/workshops/workshops.controller.ts,src/workshops/workshops.service.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/index.ts,src/registrations/registrations.module.ts,src/workshops/index.ts,src/workshops/workshops.module.ts,src/workshops/workshops.service.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/index.ts,src/registrations/registrations.module.ts,src/workshops/index.ts,src/workshops/workshops.module.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/index.ts,src/registrations/registrations.module.ts,src/workshops/index.ts,src/workshops/workshops.service.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/index.ts,src/registrations/registrations.module.ts}; FF-S02|{src/domain/index.ts,src/domain/registration-policy.ts,src/registrations/index.ts,src/registrations/registrations.service.ts}
- **barrel-add hexagonal/v01-domain-uses-outbound-adapter-constant** (violation; one export-star barrel per directory) layer-pair invariant, files differ
  - lost (rule, file, target): FF-S01|src/domain/services/PriceCalculator.ts|src/adapters/outbound/payment/FakePaymentGateway.ts; FF-S04|src/domain/services/PriceCalculator.ts|src/adapters/outbound/payment/FakePaymentGateway.ts
  - gained (rule, file, target): FF-S01|src/domain/services/PriceCalculator.ts|src/adapters/outbound/payment/index.ts; FF-S04|src/domain/services/PriceCalculator.ts|src/adapters/outbound/payment/index.ts
- **barrel-add hexagonal/v02-domain-entity-uses-driven-port** (violation; one export-star barrel per directory) NOT INVARIANT
  - gained (rule, layer pair): FF-S02|{application,domain}
  - lost (rule, file, target): FF-S01|src/domain/model/Booking.ts|src/application/ports/out/NotificationSender.ts; FF-S04|src/domain/model/Booking.ts|src/application/ports/out/NotificationSender.ts
  - gained (rule, file, target): FF-S01|src/domain/model/Booking.ts|src/application/ports/out/index.ts; FF-S02|{src/application/ports/out/BookingRepository.ts,src/application/ports/out/index.ts,src/domain/model/Booking.ts,src/domain/model/index.ts}; FF-S02|{src/application/ports/out/GuestRepository.ts,src/application/ports/out/index.ts,src/domain/model/Booking.ts,src/domain/model/index.ts}; FF-S02|{src/application/ports/out/PaymentGateway.ts,src/application/ports/out/index.ts,src/domain/model/Booking.ts,src/domain/model/index.ts}; FF-S02|{src/application/ports/out/RoomRepository.ts,src/application/ports/out/index.ts,src/domain/model/Booking.ts,src/domain/model/index.ts}; FF-S04|src/domain/model/Booking.ts|src/application/ports/out/index.ts
- **barrel-add hexagonal/v03-use-case-injects-concrete-adapter** (violation; one export-star barrel per directory) layer-pair invariant, files differ
  - lost (rule, file, target): FF-S01|src/application/services/FindAvailableRoomsService.ts|src/adapters/outbound/persistence/InMemoryRoomRepository.ts
  - gained (rule, file, target): FF-S01|src/application/services/FindAvailableRoomsService.ts|src/adapters/outbound/persistence/index.ts
- **barrel-add hexagonal/v04-use-case-throws-http-error** (violation; one export-star barrel per directory) layer-pair invariant, files differ
  - lost (rule, file, target): FF-S01|src/application/services/CancelBookingService.ts|src/adapters/inbound/http/HttpTypes.ts
  - gained (rule, file, target): FF-S01|src/application/services/CancelBookingService.ts|src/adapters/inbound/http/index.ts
- **barrel-add hexagonal/v10-domain-service-holds-adapter** (violation; one export-star barrel per directory) layer-pair invariant, files differ
  - lost (rule, file, target): FF-S01|src/domain/services/AvailabilityChecker.ts|src/adapters/outbound/persistence/InMemoryBookingRepository.ts; FF-S04|src/domain/services/AvailabilityChecker.ts|src/adapters/outbound/persistence/InMemoryBookingRepository.ts
  - gained (rule, file, target): FF-S01|src/domain/services/AvailabilityChecker.ts|src/adapters/outbound/persistence/index.ts; FF-S04|src/domain/services/AvailabilityChecker.ts|src/adapters/outbound/persistence/index.ts
- **barrel-add ddd/g03-deep-import-of-reexported-file** (violation; one export-star barrel per directory) layer-pair invariant, files differ
  - lost (rule, file, target): FF-DS02|src/billing/api/InvoiceController.ts|src/ordering/application/GetOrderSummary.ts
  - gained (rule, file, target): FF-DS02|src/billing/api/InvoiceController.ts|src/ordering/application/index.ts
- **barrel-add ddd/v07-module-outside-context** (violation; one export-star barrel per directory) layer-pair invariant, files differ
  - gained (rule, file, target): FF-DS01|src/utils/index.ts|
- **barrel-add ddd/v08-cross-context-internal-import** (violation; one export-star barrel per directory) layer-pair invariant, files differ
  - lost (rule, file, target): FF-DS02|src/billing/application/IssueInvoice.ts|src/ordering/domain/order/Order.ts
  - gained (rule, file, target): FF-DS02|src/billing/application/IssueInvoice.ts|src/ordering/domain/order/index.ts
- **barrel-add ddd/v09-domain-imports-application** (violation; one export-star barrel per directory) layer-pair invariant, files differ
  - lost (rule, file, target): FF-S01|src/ordering/domain/customer/Customer.ts|src/ordering/application/PlaceOrder.ts
  - gained (rule, file, target): FF-S01|src/ordering/domain/customer/Customer.ts|src/ordering/application/index.ts
- **barrel-remove ddd/g02-barrel-reexported-service** (near-miss; import declaring files directly, delete barrels) NOT INVARIANT
  - defining verdict: verdict:pass -> verdict:fail
  - tool verdict: pass -> fail
  - gained (rule, layer pair): FF-DS02|billing:api>ordering:application
  - gained (rule, file, target): FF-DS02|src/billing/api/InvoiceController.ts|src/ordering/application/GetOrderSummary.ts
- **merge clean-architecture/clean** (clean; merge src/infrastructure/http/BookController.ts into src/infrastructure/http/HttpTypes.ts) NOT INVARIANT
  - defining verdict: verdict:pass -> verdict:fail
  - tool verdict: pass -> fail
  - gained (rule, layer pair): FF-S02|{infrastructure}
  - gained (rule, file, target): FF-S02|{src/infrastructure/http/ErrorMapper.ts,src/infrastructure/http/HttpTypes.ts}
- **merge clean-architecture/n01-second-composition-root-for-tests** (near-miss; merge src/infrastructure/http/BookController.ts into src/infrastructure/http/HttpTypes.ts) NOT INVARIANT
  - defining verdict: verdict:pass -> verdict:fail
  - tool verdict: pass -> fail
  - gained (rule, layer pair): FF-S02|{infrastructure}
  - gained (rule, file, target): FF-S02|{src/infrastructure/http/ErrorMapper.ts,src/infrastructure/http/HttpTypes.ts}
- **merge clean-architecture/n02-report-writer-named-like-repo** (near-miss; merge src/infrastructure/http/BookController.ts into src/infrastructure/http/HttpTypes.ts) NOT INVARIANT
  - defining verdict: verdict:pass -> verdict:fail
  - tool verdict: pass -> fail
  - gained (rule, layer pair): FF-S02|{infrastructure}
  - gained (rule, file, target): FF-S02|{src/infrastructure/http/ErrorMapper.ts,src/infrastructure/http/HttpTypes.ts}
- **merge clean-architecture/n03-controller-uses-dto-that-wraps-entity** (near-miss; merge src/infrastructure/http/BookController.ts into src/infrastructure/http/HttpTypes.ts) NOT INVARIANT
  - defining verdict: verdict:pass -> verdict:fail
  - tool verdict: pass -> fail
  - gained (rule, layer pair): FF-S02|{infrastructure}
  - gained (rule, file, target): FF-S02|{src/infrastructure/http/ErrorMapper.ts,src/infrastructure/http/HttpTypes.ts}
- **merge clean-architecture/v07-controller-reads-entity** (violation; merge src/infrastructure/http/HttpTypes.ts into src/infrastructure/http/LoanController.ts (merged file first)) NOT INVARIANT
  - tool verdict: pass -> fail
  - gained (rule, layer pair): FF-S02|{infrastructure}
  - gained (rule, file, target): FF-S02|{src/infrastructure/http/ErrorMapper.ts,src/infrastructure/http/LoanController.ts}
- **merge layered/v03-controller-reads-gateway** (violation; merge src/presentation/http/HttpTypes.ts into src/presentation/http/CatalogController.ts (merged file first)) NOT INVARIANT
  - gained (rule, layer pair): FF-S02|{presentation}
  - gained (rule, file, target): FF-S02|{src/presentation/http/CatalogController.ts,src/presentation/http/ErrorHandling.ts}
- **merge layered/v05-business-model-cycle** (violation; merge src/business/model/Money.ts into src/business/model/Customer.ts) layer-pair invariant, files differ
  - gained (rule, file, target): FF-S02|{src/business/model/Customer.ts,src/business/model/Order.ts,src/business/model/OrderLine.ts}
- **merge nestjs/clean** (clean; merge src/domain/domain-error.ts into src/domain/attendee-repository.ts) NOT INVARIANT
  - defining verdict: verdict:pass -> verdict:fail
  - tool verdict: pass -> fail
  - gained (rule, layer pair): FF-S02|{domain}
  - gained (rule, file, target): FF-S02|{src/domain/attendee-repository.ts,src/domain/attendee.ts}
- **merge nestjs/n01-controller-catches-domain-error** (near-miss; merge src/domain/domain-error.ts into src/domain/attendee-repository.ts) NOT INVARIANT
  - defining verdict: verdict:pass -> verdict:fail
  - tool verdict: pass -> fail
  - gained (rule, layer pair): FF-S02|{domain}
  - gained (rule, file, target): FF-S02|{src/domain/attendee-repository.ts,src/domain/attendee.ts}
- **merge nestjs/n02-domain-port-named-dot-repository** (near-miss; merge src/domain/domain-error.ts into src/domain/attendee-repository.ts) NOT INVARIANT
  - defining verdict: verdict:pass -> verdict:fail
  - tool verdict: pass -> fail
  - gained (rule, layer pair): FF-S02|{domain}
  - gained (rule, file, target): FF-S02|{src/domain/attendee-repository.ts,src/domain/attendee.ts}
- **merge nestjs/n03-service-injects-sibling-service** (near-miss; merge src/domain/domain-error.ts into src/domain/attendee-repository.ts) NOT INVARIANT
  - defining verdict: verdict:pass -> verdict:fail
  - tool verdict: pass -> fail
  - gained (rule, layer pair): FF-S02|{domain}
  - gained (rule, file, target): FF-S02|{src/domain/attendee-repository.ts,src/domain/attendee.ts}
- **merge nestjs/v03-service-imports-guard** (violation; merge src/domain/domain-error.ts into src/domain/attendee-repository.ts) NOT INVARIANT
  - gained (rule, layer pair): FF-S02|{domain}
  - gained (rule, file, target): FF-S02|{src/domain/attendee-repository.ts,src/domain/attendee.ts}
- **merge nestjs/v07-service-injects-concrete-repository** (violation; merge src/domain/domain-error.ts into src/domain/attendee-repository.ts) NOT INVARIANT
  - tool verdict: pass -> fail
  - gained (rule, layer pair): FF-S02|{domain}
  - gained (rule, file, target): FF-S02|{src/domain/attendee-repository.ts,src/domain/attendee.ts}
- **merge nestjs/v08-repository-without-port** (violation; merge src/domain/domain-error.ts into src/domain/attendee-repository.ts) NOT INVARIANT
  - gained (rule, layer pair): FF-S02|{domain}
  - gained (rule, file, target): FF-S02|{src/domain/attendee-repository.ts,src/domain/attendee.ts}
- **rename-opaque clean-architecture/v05-use-case-injects-concrete-repository** (violation; opaque names) NOT INVARIANT
  - defining verdict: FF-P02:violated,FF-P04:violated,FF-S01:violated -> FF-P02:violated,FF-P04:clean,FF-S01:violated
- **rename-opaque clean-architecture/v06-repository-without-port** (violation; opaque names) NOT INVARIANT
  - defining verdict: FF-P03:violated -> FF-P03:clean
  - tool verdict: fail -> pass
  - lost (rule, layer pair): FF-P03|infrastructure>-
  - lost (rule, file, target): FF-P03|src/infrastructure/persistence/InMemoryLoanRepository.ts|
- **rename-opaque nestjs/v02-repository-builds-response-dto** (violation; opaque names) NOT INVARIANT
  - defining verdict: FF-S01:violated -> FF-S01:clean
  - tool verdict: fail -> pass
  - lost (rule, layer pair): FF-S01|infrastructure>application
  - lost (rule, file, target): FF-S01|src/workshops/in-memory-workshop.repository.ts|src/workshops/dto/workshop-response.dto.ts
- **rename-opaque nestjs/v03-service-imports-guard** (violation; opaque names) NOT INVARIANT
  - defining verdict: FF-S01:violated -> FF-S01:clean
  - tool verdict: fail -> pass
  - lost (rule, layer pair): FF-S01|application>presentation
  - lost (rule, file, target): FF-S01|src/registrations/registrations.service.ts|src/common/guards/api-key.guard.ts
- **rename-opaque nestjs/v07-service-injects-concrete-repository** (violation; opaque names) NOT INVARIANT
  - defining verdict: FF-P02:violated -> FF-P02:clean
- **rename-opaque nestjs/v08-repository-without-port** (violation; opaque names) NOT INVARIANT
  - defining verdict: FF-P03:violated -> FF-P03:clean
  - tool verdict: fail -> pass
  - lost (rule, layer pair): FF-P03|infrastructure>-
  - lost (rule, file, target): FF-P03|src/attendees/in-memory-attendee.repository.ts|
- **rename-opaque nestjs/v10-domain-policy-holds-repository** (violation; opaque names) NOT INVARIANT
  - defining verdict: FF-P06:violated,FF-S01:violated,FF-S04:violated -> FF-P06:clean,FF-S01:clean,FF-S04:clean
  - tool verdict: fail -> pass
  - lost (rule, layer pair): FF-P06|domain>infrastructure; FF-S01|domain>infrastructure; FF-S04|domain>infrastructure
  - lost (rule, file, target): FF-P06|src/domain/registration-policy.ts|src/registrations/in-memory-registration.repository.ts; FF-S01|src/domain/registration-policy.ts|src/registrations/in-memory-registration.repository.ts; FF-S04|src/domain/registration-policy.ts|src/registrations/in-memory-registration.repository.ts
- **rename-opaque hexagonal/v08-adapter-without-port** (violation; opaque names) NOT INVARIANT
  - defining verdict: FF-P03:violated -> FF-P03:clean
  - tool verdict: fail -> pass
  - lost (rule, layer pair): FF-P03|adapters-outbound>-
  - lost (rule, file, target): FF-P03|src/adapters/outbound/payment/FakePaymentGateway.ts|
- **rename-opaque hexagonal/v09-adapter-implements-local-interface** (violation; opaque names) NOT INVARIANT
  - defining verdict: FF-P03:violated -> FF-P03:clean
  - tool verdict: fail -> pass
  - lost (rule, layer pair): FF-P03|adapters-outbound>-
  - lost (rule, file, target): FF-P03|src/adapters/outbound/persistence/InMemoryRoomRepository.ts|
- **rename-opaque ddd/v02-repository-for-inner-entity** (violation; opaque names) NOT INVARIANT
  - defining verdict: FF-DT02:violated -> FF-DT02:clean
  - tool verdict: fail -> pass
  - lost (rule, layer pair): FF-DT02|ordering:domain>ordering:domain
  - lost (rule, file, target): FF-DT02|src/ordering/domain/order/OrderLineRepository.ts|src/ordering/domain/order/OrderLine.ts
- **rename-spec-stale ddd/v01-aggregate-boundary** (violation; Acme prefix, spec not updated) NOT INVARIANT
  - defining verdict: FF-DT01:violated -> FF-DT01:clean
  - tool verdict: fail -> pass
  - lost (rule, layer pair): FF-DT01|ordering:application>ordering:domain
  - lost (rule, file, target): FF-DT01|src/ordering/application/GetOrderSummary.ts|src/ordering/domain/order/OrderLine.ts
- **rename-spec-stale ddd/v02-repository-for-inner-entity** (violation; Acme prefix, spec not updated) NOT INVARIANT
  - defining verdict: FF-DT02:violated -> FF-DT02:clean
  - tool verdict: fail -> pass
  - lost (rule, layer pair): FF-DT02|ordering:domain>ordering:domain
  - lost (rule, file, target): FF-DT02|src/ordering/domain/order/OrderLineRepository.ts|src/ordering/domain/order/OrderLine.ts
- **rename-spec-stale ddd/v05-event-outside-domain** (violation; Acme prefix, spec not updated) NOT INVARIANT
  - defining verdict: FF-DT05:violated -> FF-DT05:clean
