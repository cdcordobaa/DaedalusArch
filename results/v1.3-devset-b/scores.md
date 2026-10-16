# v1.3 devset-b scores (development data, Claude-written)

Blocking rules only unless stated. `found` = recall over planted expected findings; `reports right` = precision over every tool row of the rule on devset-b variants; Wilson 95% intervals. Views: see scripts/v1.3/devset-b-score.ts (literal; cycle-containment).

# View: literal

| Style | Violations | Look-alikes | Clean | Blocking expected | Found | Reports right | Planted rule detected | Look-alikes silent | Look-alike false-alarm rows | Clean silent | Clean false-alarm rows |
|---|---|---|---|---|---|---|---|---|---|---|---|
| clean-architecture | 16 | 6 | 2 | 24 | 21/24 = 0.88 [0.69, 0.96] | 21/24 = 0.88 [0.69, 0.96] | 13/16 = 0.81 [0.57, 0.93] | 5/6 = 0.83 [0.44, 0.97] | 1 | 2/2 = 1.00 [0.34, 1.00] | 0 |
| layered | 15 | 6 | 2 | 21 | 20/21 = 0.95 [0.77, 0.99] | 20/21 = 0.95 [0.77, 0.99] | 14/15 = 0.93 [0.70, 0.99] | 6/6 = 1.00 [0.61, 1.00] | 0 | 2/2 = 1.00 [0.34, 1.00] | 0 |
| nestjs | 16 | 8 | 2 | 22 | 20/22 = 0.91 [0.72, 0.97] | 20/21 = 0.95 [0.77, 0.99] | 14/16 = 0.88 [0.64, 0.97] | 8/8 = 1.00 [0.68, 1.00] | 0 | 2/2 = 1.00 [0.34, 1.00] | 0 |
| hexagonal | 16 | 6 | 2 | 24 | 23/24 = 0.96 [0.80, 0.99] | 23/24 = 0.96 [0.80, 0.99] | 15/16 = 0.94 [0.72, 0.99] | 6/6 = 1.00 [0.61, 1.00] | 0 | 2/2 = 1.00 [0.34, 1.00] | 0 |
| ddd | 21 | 11 | 2 | 25 | 25/25 = 1.00 [0.87, 1.00] | 25/25 = 1.00 [0.87, 1.00] | 21/21 = 1.00 [0.85, 1.00] | 11/11 = 1.00 [0.74, 1.00] | 0 | 2/2 = 1.00 [0.34, 1.00] | 0 |
| **pooled** | | | | 116 | 109/116 = 0.94 [0.88, 0.97] | 109/115 = 0.95 [0.89, 0.98] | | | | | |

## clean-architecture (literal)

| Rule | Name | Tier | Violation variants | Look-alikes | Found | Reports right | Extra rows on violations | False alarms (look-alike) | False alarms (clean) |
|---|---|---|---|---|---|---|---|---|---|
| FF-S01 | dependency-direction | blocking | 3 | 1 | 8/8 = 1.00 [0.68, 1.00] | 8/8 = 1.00 [0.68, 1.00] | 0 | 0 | 0 |
| FF-S02 | no-cyclic-deps | blocking | 3 | 1 | 1/3 = 0.33 [0.06, 0.79] | 1/3 = 0.33 [0.06, 0.79] | 2 | 0 | 0 |
| FF-S04 | no-domain-outward-dep | blocking | 3 | 1 | 6/6 = 1.00 [0.61, 1.00] | 6/6 = 1.00 [0.61, 1.00] | 0 | 0 | 0 |
| FF-P01 | domain-purity | blocking | 3 | 1 | 3/3 = 1.00 [0.44, 1.00] | 3/3 = 1.00 [0.44, 1.00] | 0 | 0 | 0 |
| FF-P02 | dependency-inversion | advisory | 0 | 0 | 0/0 (n/a) | 0/0 (n/a) | 0 | 0 | 0 |
| FF-P03 | repository-pattern | blocking | 2 | 1 | 1/2 = 0.50 [0.09, 0.91] | 1/2 = 0.50 [0.09, 0.91] | 0 | 1 | 0 |
| FF-P04 | use-case-isolation | advisory | 0 | 0 | 0/0 (n/a) | 0/0 (n/a) | 0 | 0 | 0 |
| FF-P05 | controller-no-entity | advisory | 0 | 0 | 0/0 (n/a) | 0/0 (n/a) | 0 | 0 | 0 |
| FF-P06 | domain-state-purity | blocking | 2 | 1 | 2/2 = 1.00 [0.34, 1.00] | 2/2 = 1.00 [0.34, 1.00] | 0 | 0 | 0 |

### Blocking misses (3)

| Variant | Role | Rule | File | Target | Also on baseline | Manifest reason / tool message |
|---|---|---|---|---|---|---|
| v27-loan-period-reads-policy-limit-cycle | violation | FF-S02 | src/domain/entities/Loan.ts | src/domain/value-objects/LoanPeriod.ts |  | Three-file import cycle Loan -> LoanPeriod -> LoanPolicy -> Loan (ADP); keyed on the lexicographically smallest path, target the next file of the cycle. |
| v29-http-barrel-error-mapper-cycle | violation | FF-S02 | src/infrastructure/http/BookController.ts | src/infrastructure/http/ErrorMapper.ts |  | Three-file cycle BookController -> ErrorMapper -> index (re-export) -> BookController; keyed on the lexicographically smallest path (B < E < i). |
| v34-member-repository-implements-local-store | violation | FF-P03 | src/infrastructure/persistence/InMemoryMemberRepository.ts |  |  | An infrastructure repository implements an infrastructure-local interface, not the domain repository interface. |

### Blocking false alarms (look-alike and clean variants) (1)

| Variant | Role | Rule | File | Target | Also on baseline | Manifest reason / tool message |
|---|---|---|---|---|---|---|
| n25-caching-book-repository-aliased-port | look-alike | FF-P03 | src/infrastructure/persistence/CachingBookRepository.ts |  |  | Violation in src/infrastructure/persistence/CachingBookRepository.ts |

### Blocking rows beyond the manifest on violation variants (2)

| Variant | Role | Rule | File | Target | Also on baseline | Manifest reason / tool message |
|---|---|---|---|---|---|---|
| v27-loan-period-reads-policy-limit-cycle | violation | FF-S02 | src/domain/entities/Loan.ts,src/domain/value-objects/LoanPeriod.ts,src/domain/services/LoanPolicy.ts,src/domain/entities/Loan.ts | src/domain/value-objects/LoanPeriod.ts |  | Circular dependency: src/domain/entities/Loan.ts,src/domain/value-objects/LoanPeriod.ts,src/domain/services/LoanPolicy.ts,src/domain/entities/Loan.ts |
| v29-http-barrel-error-mapper-cycle | violation | FF-S02 | src/infrastructure/http/BookController.ts,src/infrastructure/http/ErrorMapper.ts,src/infrastructure/http/index.ts,src/infrastructure/http/BookController.ts | src/infrastructure/http/ErrorMapper.ts |  | Circular dependency: src/infrastructure/http/BookController.ts,src/infrastructure/http/ErrorMapper.ts,src/infrastructure/http/index.ts,src/infrastructure/http/BookController.ts |

## layered (literal)

| Rule | Name | Tier | Violation variants | Look-alikes | Found | Reports right | Extra rows on violations | False alarms (look-alike) | False alarms (clean) |
|---|---|---|---|---|---|---|---|---|---|
| FF-S01 | dependency-direction | blocking | 4 | 1 | 5/5 = 1.00 [0.57, 1.00] | 5/5 = 1.00 [0.57, 1.00] | 0 | 0 | 0 |
| FF-S02 | no-cyclic-deps | blocking | 4 | 1 | 3/4 = 0.75 [0.30, 0.95] | 3/4 = 0.75 [0.30, 0.95] | 1 | 0 | 0 |
| FF-S03 | no-layer-skip | blocking | 4 | 2 | 9/9 = 1.00 [0.70, 1.00] | 9/9 = 1.00 [0.70, 1.00] | 0 | 0 | 0 |
| FF-P01 | domain-purity | blocking | 3 | 1 | 3/3 = 1.00 [0.44, 1.00] | 3/3 = 1.00 [0.44, 1.00] | 0 | 0 | 0 |
| FF-P06 | domain-state-purity | blocking | 0 | 1 | 0/0 (n/a) | 0/0 (n/a) | 0 | 0 | 0 |

Not planted: FF-P06: No style-valid violation exists in layered (reference.json noViolatingVariant, RDQ-1): the rule binds domain = business and infrastructure = persistence, and in closed layering a business class holding a persistence gateway is the intended downward dependency; business holding a presentation object is not infrastructure state and is already an FF-S01/FF-S03 defect. Only the look-alike n26 is written.

### Blocking misses (1)

| Variant | Role | Rule | File | Target | Also on baseline | Manifest reason / tool message |
|---|---|---|---|---|---|---|
| v30-order-line-product-order-cycle | violation | FF-S02 | src/business/model/Order.ts | src/business/model/OrderLine.ts |  | Three-file import cycle Order -> OrderLine -> Product -> Order; "Order.ts" sorts before "OrderLine.ts" (. < L). |

### Blocking false alarms (look-alike and clean variants) (0)

None.

### Blocking rows beyond the manifest on violation variants (1)

| Variant | Role | Rule | File | Target | Also on baseline | Manifest reason / tool message |
|---|---|---|---|---|---|---|
| v30-order-line-product-order-cycle | violation | FF-S02 | src/business/model/Order.ts,src/business/model/OrderLine.ts,src/business/model/Product.ts,src/business/model/Order.ts | src/business/model/OrderLine.ts |  | Circular dependency: src/business/model/Order.ts,src/business/model/OrderLine.ts,src/business/model/Product.ts,src/business/model/Order.ts |

## nestjs (literal)

| Rule | Name | Tier | Violation variants | Look-alikes | Found | Reports right | Extra rows on violations | False alarms (look-alike) | False alarms (clean) |
|---|---|---|---|---|---|---|---|---|---|
| FF-S01 | dependency-direction | blocking | 3 | 1 | 7/7 = 1.00 [0.65, 1.00] | 7/7 = 1.00 [0.65, 1.00] | 0 | 0 | 0 |
| FF-S02 | no-cyclic-deps | blocking | 4 | 1 | 3/4 = 0.75 [0.30, 0.95] | 3/4 = 0.75 [0.30, 0.95] | 1 | 0 | 0 |
| FF-S04 | no-domain-outward-dep | blocking | 2 | 1 | 4/4 = 1.00 [0.51, 1.00] | 4/4 = 1.00 [0.51, 1.00] | 0 | 0 | 0 |
| FF-P01 | domain-purity | blocking | 3 | 2 | 3/3 = 1.00 [0.44, 1.00] | 3/3 = 1.00 [0.44, 1.00] | 0 | 0 | 0 |
| FF-P02 | dependency-inversion | advisory | 0 | 0 | 0/0 (n/a) | 0/0 (n/a) | 0 | 0 | 0 |
| FF-P03 | repository-pattern | blocking | 2 | 2 | 1/2 = 0.50 [0.09, 0.91] | 1/1 = 1.00 [0.21, 1.00] | 0 | 0 | 0 |
| FF-P04 | use-case-isolation | advisory | 0 | 0 | 0/0 (n/a) | 0/0 (n/a) | 0 | 0 | 0 |
| FF-P05 | controller-no-entity | advisory | 0 | 0 | 0/0 (n/a) | 0/0 (n/a) | 0 | 0 | 0 |
| FF-P06 | domain-state-purity | blocking | 2 | 1 | 2/2 = 1.00 [0.34, 1.00] | 2/2 = 1.00 [0.34, 1.00] | 0 | 0 | 0 |

### Blocking misses (2)

| Variant | Role | Rule | File | Target | Also on baseline | Manifest reason / tool message |
|---|---|---|---|---|---|---|
| v26-three-response-dto-cycle | violation | FF-S02 | src/attendees/dto/attendee-response.dto.ts | src/registrations/dto/registration-response.dto.ts |  | Three-file import cycle attendee-response -> registration-response -> workshop-response -> attendee-response; the smallest path is the attendees DTO and the next file is the registrations DTO. |
| v32-workshop-repository-local-store-interface | violation | FF-P03 | src/workshops/in-memory-workshop.repository.ts |  |  | The infrastructure repository implements no domain-owned repository interface; its only interface is declared in the infrastructure layer. |

### Blocking false alarms (look-alike and clean variants) (0)

None.

### Blocking rows beyond the manifest on violation variants (1)

| Variant | Role | Rule | File | Target | Also on baseline | Manifest reason / tool message |
|---|---|---|---|---|---|---|
| v26-three-response-dto-cycle | violation | FF-S02 | src/attendees/dto/attendee-response.dto.ts,src/registrations/dto/registration-response.dto.ts,src/workshops/dto/workshop-response.dto.ts,src/attendees/dto/attendee-response.dto.ts | src/registrations/dto/registration-response.dto.ts |  | Circular dependency: src/attendees/dto/attendee-response.dto.ts,src/registrations/dto/registration-response.dto.ts,src/workshops/dto/workshop-response.dto.ts,src/attendees/dto/attendee-response.dto.ts |

## hexagonal (literal)

| Rule | Name | Tier | Violation variants | Look-alikes | Found | Reports right | Extra rows on violations | False alarms (look-alike) | False alarms (clean) |
|---|---|---|---|---|---|---|---|---|---|
| FF-S01 | dependency-direction-graph | blocking | 4 | 1 | 8/8 = 1.00 [0.68, 1.00] | 8/8 = 1.00 [0.68, 1.00] | 0 | 0 | 0 |
| FF-S02 | no-cyclic-deps | blocking | 3 | 1 | 4/5 = 0.80 [0.38, 0.96] | 4/5 = 0.80 [0.38, 0.96] | 1 | 0 | 0 |
| FF-S03 | layer-skip-graph | advisory | 0 | 0 | 0/0 (n/a) | 0/0 (n/a) | 0 | 0 | 0 |
| FF-S04 | core-isolation | blocking | 2 | 1 | 4/4 = 1.00 [0.51, 1.00] | 4/4 = 1.00 [0.51, 1.00] | 0 | 0 | 0 |
| FF-P01 | domain-purity | blocking | 2 | 1 | 2/2 = 1.00 [0.34, 1.00] | 2/2 = 1.00 [0.34, 1.00] | 0 | 0 | 0 |
| FF-P02 | port-dependency-inversion | advisory | 0 | 0 | 0/0 (n/a) | 0/0 (n/a) | 0 | 0 | 0 |
| FF-P03 | port-adapter-pattern | blocking | 3 | 1 | 3/3 = 1.00 [0.44, 1.00] | 3/3 = 1.00 [0.44, 1.00] | 0 | 0 | 0 |
| FF-P06 | domain-state-purity | blocking | 2 | 1 | 2/2 = 1.00 [0.34, 1.00] | 2/2 = 1.00 [0.34, 1.00] | 0 | 0 | 0 |

### Blocking misses (1)

| Variant | Role | Rule | File | Target | Also on baseline | Manifest reason / tool message |
|---|---|---|---|---|---|---|
| v26-http-links-routes-cycle | violation | FF-S02 | src/adapters/inbound/http/BookingController.ts | src/adapters/inbound/http/links.ts |  | Three-file import cycle BookingController -> links -> routes -> BookingController. |

### Blocking false alarms (look-alike and clean variants) (0)

None.

### Blocking rows beyond the manifest on violation variants (1)

| Variant | Role | Rule | File | Target | Also on baseline | Manifest reason / tool message |
|---|---|---|---|---|---|---|
| v26-http-links-routes-cycle | violation | FF-S02 | src/adapters/inbound/http/BookingController.ts,src/adapters/inbound/http/links.ts,src/adapters/inbound/http/routes.ts,src/adapters/inbound/http/BookingController.ts | src/adapters/inbound/http/links.ts |  | Circular dependency: src/adapters/inbound/http/BookingController.ts,src/adapters/inbound/http/links.ts,src/adapters/inbound/http/routes.ts,src/adapters/inbound/http/BookingController.ts |

## ddd (literal)

| Rule | Name | Tier | Violation variants | Look-alikes | Found | Reports right | Extra rows on violations | False alarms (look-alike) | False alarms (clean) |
|---|---|---|---|---|---|---|---|---|---|
| FF-DS01 | bounded-context-modules | blocking | 3 | 1 | 4/4 = 1.00 [0.51, 1.00] | 4/4 = 1.00 [0.51, 1.00] | 0 | 0 | 0 |
| FF-DS02 | context-isolation | blocking | 4 | 2 | 5/5 = 1.00 [0.57, 1.00] | 5/5 = 1.00 [0.57, 1.00] | 0 | 0 | 0 |
| FF-DT01 | aggregate-boundary | blocking | 3 | 1 | 4/4 = 1.00 [0.51, 1.00] | 4/4 = 1.00 [0.51, 1.00] | 0 | 0 | 0 |
| FF-DT02 | repository-aggregate-root | blocking | 2 | 1 | 3/3 = 1.00 [0.44, 1.00] | 3/3 = 1.00 [0.44, 1.00] | 0 | 0 | 0 |
| FF-DT03 | value-object-immutability | blocking | 3 | 2 | 3/3 = 1.00 [0.44, 1.00] | 3/3 = 1.00 [0.44, 1.00] | 0 | 0 | 0 |
| FF-DT04 | domain-purity | blocking | 3 | 2 | 3/3 = 1.00 [0.44, 1.00] | 3/3 = 1.00 [0.44, 1.00] | 0 | 0 | 0 |
| FF-DT05 | domain-event-placement | advisory | 0 | 0 | 0/0 (n/a) | 0/0 (n/a) | 0 | 0 | 0 |
| FF-DT06 | application-service-thin | advisory | 0 | 0 | 0/0 (n/a) | 0/0 (n/a) | 0 | 0 | 0 |
| FF-S01 | dependency-direction-graph | blocking | 3 | 2 | 3/3 = 1.00 [0.44, 1.00] | 3/3 = 1.00 [0.44, 1.00] | 0 | 0 | 0 |
| FF-S03 | layer-skip-graph | advisory | 0 | 0 | 0/0 (n/a) | 0/0 (n/a) | 0 | 0 | 0 |

### Blocking misses (0)

None.

### Blocking false alarms (look-alike and clean variants) (0)

None.

### Blocking rows beyond the manifest on violation variants (0)

None.

# View: cycle-containment

| Style | Violations | Look-alikes | Clean | Blocking expected | Found | Reports right | Planted rule detected | Look-alikes silent | Look-alike false-alarm rows | Clean silent | Clean false-alarm rows |
|---|---|---|---|---|---|---|---|---|---|---|---|
| clean-architecture | 16 | 6 | 2 | 24 | 23/24 = 0.96 [0.80, 0.99] | 23/24 = 0.96 [0.80, 0.99] | 15/16 = 0.94 [0.72, 0.99] | 5/6 = 0.83 [0.44, 0.97] | 1 | 2/2 = 1.00 [0.34, 1.00] | 0 |
| layered | 15 | 6 | 2 | 21 | 21/21 = 1.00 [0.85, 1.00] | 21/21 = 1.00 [0.85, 1.00] | 15/15 = 1.00 [0.80, 1.00] | 6/6 = 1.00 [0.61, 1.00] | 0 | 2/2 = 1.00 [0.34, 1.00] | 0 |
| nestjs | 16 | 8 | 2 | 22 | 21/22 = 0.95 [0.78, 0.99] | 21/21 = 1.00 [0.85, 1.00] | 15/16 = 0.94 [0.72, 0.99] | 8/8 = 1.00 [0.68, 1.00] | 0 | 2/2 = 1.00 [0.34, 1.00] | 0 |
| hexagonal | 16 | 6 | 2 | 24 | 24/24 = 1.00 [0.86, 1.00] | 24/24 = 1.00 [0.86, 1.00] | 16/16 = 1.00 [0.81, 1.00] | 6/6 = 1.00 [0.61, 1.00] | 0 | 2/2 = 1.00 [0.34, 1.00] | 0 |
| ddd | 21 | 11 | 2 | 25 | 25/25 = 1.00 [0.87, 1.00] | 25/25 = 1.00 [0.87, 1.00] | 21/21 = 1.00 [0.85, 1.00] | 11/11 = 1.00 [0.74, 1.00] | 0 | 2/2 = 1.00 [0.34, 1.00] | 0 |
| **pooled** | | | | 116 | 114/116 = 0.98 [0.94, 1.00] | 114/115 = 0.99 [0.95, 1.00] | | | | | |

## clean-architecture (cycle-containment)

| Rule | Name | Tier | Violation variants | Look-alikes | Found | Reports right | Extra rows on violations | False alarms (look-alike) | False alarms (clean) |
|---|---|---|---|---|---|---|---|---|---|
| FF-S01 | dependency-direction | blocking | 3 | 1 | 8/8 = 1.00 [0.68, 1.00] | 8/8 = 1.00 [0.68, 1.00] | 0 | 0 | 0 |
| FF-S02 | no-cyclic-deps | blocking | 3 | 1 | 3/3 = 1.00 [0.44, 1.00] | 3/3 = 1.00 [0.44, 1.00] | 0 | 0 | 0 |
| FF-S04 | no-domain-outward-dep | blocking | 3 | 1 | 6/6 = 1.00 [0.61, 1.00] | 6/6 = 1.00 [0.61, 1.00] | 0 | 0 | 0 |
| FF-P01 | domain-purity | blocking | 3 | 1 | 3/3 = 1.00 [0.44, 1.00] | 3/3 = 1.00 [0.44, 1.00] | 0 | 0 | 0 |
| FF-P02 | dependency-inversion | advisory | 0 | 0 | 0/0 (n/a) | 0/0 (n/a) | 0 | 0 | 0 |
| FF-P03 | repository-pattern | blocking | 2 | 1 | 1/2 = 0.50 [0.09, 0.91] | 1/2 = 0.50 [0.09, 0.91] | 0 | 1 | 0 |
| FF-P04 | use-case-isolation | advisory | 0 | 0 | 0/0 (n/a) | 0/0 (n/a) | 0 | 0 | 0 |
| FF-P05 | controller-no-entity | advisory | 0 | 0 | 0/0 (n/a) | 0/0 (n/a) | 0 | 0 | 0 |
| FF-P06 | domain-state-purity | blocking | 2 | 1 | 2/2 = 1.00 [0.34, 1.00] | 2/2 = 1.00 [0.34, 1.00] | 0 | 0 | 0 |

### Blocking misses (1)

| Variant | Role | Rule | File | Target | Also on baseline | Manifest reason / tool message |
|---|---|---|---|---|---|---|
| v34-member-repository-implements-local-store | violation | FF-P03 | src/infrastructure/persistence/InMemoryMemberRepository.ts |  |  | An infrastructure repository implements an infrastructure-local interface, not the domain repository interface. |

### Blocking false alarms (look-alike and clean variants) (1)

| Variant | Role | Rule | File | Target | Also on baseline | Manifest reason / tool message |
|---|---|---|---|---|---|---|
| n25-caching-book-repository-aliased-port | look-alike | FF-P03 | src/infrastructure/persistence/CachingBookRepository.ts |  |  | Violation in src/infrastructure/persistence/CachingBookRepository.ts |

### Blocking rows beyond the manifest on violation variants (0)

None.

## layered (cycle-containment)

| Rule | Name | Tier | Violation variants | Look-alikes | Found | Reports right | Extra rows on violations | False alarms (look-alike) | False alarms (clean) |
|---|---|---|---|---|---|---|---|---|---|
| FF-S01 | dependency-direction | blocking | 4 | 1 | 5/5 = 1.00 [0.57, 1.00] | 5/5 = 1.00 [0.57, 1.00] | 0 | 0 | 0 |
| FF-S02 | no-cyclic-deps | blocking | 4 | 1 | 4/4 = 1.00 [0.51, 1.00] | 4/4 = 1.00 [0.51, 1.00] | 0 | 0 | 0 |
| FF-S03 | no-layer-skip | blocking | 4 | 2 | 9/9 = 1.00 [0.70, 1.00] | 9/9 = 1.00 [0.70, 1.00] | 0 | 0 | 0 |
| FF-P01 | domain-purity | blocking | 3 | 1 | 3/3 = 1.00 [0.44, 1.00] | 3/3 = 1.00 [0.44, 1.00] | 0 | 0 | 0 |
| FF-P06 | domain-state-purity | blocking | 0 | 1 | 0/0 (n/a) | 0/0 (n/a) | 0 | 0 | 0 |

Not planted: FF-P06: No style-valid violation exists in layered (reference.json noViolatingVariant, RDQ-1): the rule binds domain = business and infrastructure = persistence, and in closed layering a business class holding a persistence gateway is the intended downward dependency; business holding a presentation object is not infrastructure state and is already an FF-S01/FF-S03 defect. Only the look-alike n26 is written.

### Blocking misses (0)

None.

### Blocking false alarms (look-alike and clean variants) (0)

None.

### Blocking rows beyond the manifest on violation variants (0)

None.

## nestjs (cycle-containment)

| Rule | Name | Tier | Violation variants | Look-alikes | Found | Reports right | Extra rows on violations | False alarms (look-alike) | False alarms (clean) |
|---|---|---|---|---|---|---|---|---|---|
| FF-S01 | dependency-direction | blocking | 3 | 1 | 7/7 = 1.00 [0.65, 1.00] | 7/7 = 1.00 [0.65, 1.00] | 0 | 0 | 0 |
| FF-S02 | no-cyclic-deps | blocking | 4 | 1 | 4/4 = 1.00 [0.51, 1.00] | 4/4 = 1.00 [0.51, 1.00] | 0 | 0 | 0 |
| FF-S04 | no-domain-outward-dep | blocking | 2 | 1 | 4/4 = 1.00 [0.51, 1.00] | 4/4 = 1.00 [0.51, 1.00] | 0 | 0 | 0 |
| FF-P01 | domain-purity | blocking | 3 | 2 | 3/3 = 1.00 [0.44, 1.00] | 3/3 = 1.00 [0.44, 1.00] | 0 | 0 | 0 |
| FF-P02 | dependency-inversion | advisory | 0 | 0 | 0/0 (n/a) | 0/0 (n/a) | 0 | 0 | 0 |
| FF-P03 | repository-pattern | blocking | 2 | 2 | 1/2 = 0.50 [0.09, 0.91] | 1/1 = 1.00 [0.21, 1.00] | 0 | 0 | 0 |
| FF-P04 | use-case-isolation | advisory | 0 | 0 | 0/0 (n/a) | 0/0 (n/a) | 0 | 0 | 0 |
| FF-P05 | controller-no-entity | advisory | 0 | 0 | 0/0 (n/a) | 0/0 (n/a) | 0 | 0 | 0 |
| FF-P06 | domain-state-purity | blocking | 2 | 1 | 2/2 = 1.00 [0.34, 1.00] | 2/2 = 1.00 [0.34, 1.00] | 0 | 0 | 0 |

### Blocking misses (1)

| Variant | Role | Rule | File | Target | Also on baseline | Manifest reason / tool message |
|---|---|---|---|---|---|---|
| v32-workshop-repository-local-store-interface | violation | FF-P03 | src/workshops/in-memory-workshop.repository.ts |  |  | The infrastructure repository implements no domain-owned repository interface; its only interface is declared in the infrastructure layer. |

### Blocking false alarms (look-alike and clean variants) (0)

None.

### Blocking rows beyond the manifest on violation variants (0)

None.

## hexagonal (cycle-containment)

| Rule | Name | Tier | Violation variants | Look-alikes | Found | Reports right | Extra rows on violations | False alarms (look-alike) | False alarms (clean) |
|---|---|---|---|---|---|---|---|---|---|
| FF-S01 | dependency-direction-graph | blocking | 4 | 1 | 8/8 = 1.00 [0.68, 1.00] | 8/8 = 1.00 [0.68, 1.00] | 0 | 0 | 0 |
| FF-S02 | no-cyclic-deps | blocking | 3 | 1 | 5/5 = 1.00 [0.57, 1.00] | 5/5 = 1.00 [0.57, 1.00] | 0 | 0 | 0 |
| FF-S03 | layer-skip-graph | advisory | 0 | 0 | 0/0 (n/a) | 0/0 (n/a) | 0 | 0 | 0 |
| FF-S04 | core-isolation | blocking | 2 | 1 | 4/4 = 1.00 [0.51, 1.00] | 4/4 = 1.00 [0.51, 1.00] | 0 | 0 | 0 |
| FF-P01 | domain-purity | blocking | 2 | 1 | 2/2 = 1.00 [0.34, 1.00] | 2/2 = 1.00 [0.34, 1.00] | 0 | 0 | 0 |
| FF-P02 | port-dependency-inversion | advisory | 0 | 0 | 0/0 (n/a) | 0/0 (n/a) | 0 | 0 | 0 |
| FF-P03 | port-adapter-pattern | blocking | 3 | 1 | 3/3 = 1.00 [0.44, 1.00] | 3/3 = 1.00 [0.44, 1.00] | 0 | 0 | 0 |
| FF-P06 | domain-state-purity | blocking | 2 | 1 | 2/2 = 1.00 [0.34, 1.00] | 2/2 = 1.00 [0.34, 1.00] | 0 | 0 | 0 |

### Blocking misses (0)

None.

### Blocking false alarms (look-alike and clean variants) (0)

None.

### Blocking rows beyond the manifest on violation variants (0)

None.

## ddd (cycle-containment)

| Rule | Name | Tier | Violation variants | Look-alikes | Found | Reports right | Extra rows on violations | False alarms (look-alike) | False alarms (clean) |
|---|---|---|---|---|---|---|---|---|---|
| FF-DS01 | bounded-context-modules | blocking | 3 | 1 | 4/4 = 1.00 [0.51, 1.00] | 4/4 = 1.00 [0.51, 1.00] | 0 | 0 | 0 |
| FF-DS02 | context-isolation | blocking | 4 | 2 | 5/5 = 1.00 [0.57, 1.00] | 5/5 = 1.00 [0.57, 1.00] | 0 | 0 | 0 |
| FF-DT01 | aggregate-boundary | blocking | 3 | 1 | 4/4 = 1.00 [0.51, 1.00] | 4/4 = 1.00 [0.51, 1.00] | 0 | 0 | 0 |
| FF-DT02 | repository-aggregate-root | blocking | 2 | 1 | 3/3 = 1.00 [0.44, 1.00] | 3/3 = 1.00 [0.44, 1.00] | 0 | 0 | 0 |
| FF-DT03 | value-object-immutability | blocking | 3 | 2 | 3/3 = 1.00 [0.44, 1.00] | 3/3 = 1.00 [0.44, 1.00] | 0 | 0 | 0 |
| FF-DT04 | domain-purity | blocking | 3 | 2 | 3/3 = 1.00 [0.44, 1.00] | 3/3 = 1.00 [0.44, 1.00] | 0 | 0 | 0 |
| FF-DT05 | domain-event-placement | advisory | 0 | 0 | 0/0 (n/a) | 0/0 (n/a) | 0 | 0 | 0 |
| FF-DT06 | application-service-thin | advisory | 0 | 0 | 0/0 (n/a) | 0/0 (n/a) | 0 | 0 | 0 |
| FF-S01 | dependency-direction-graph | blocking | 3 | 2 | 3/3 = 1.00 [0.44, 1.00] | 3/3 = 1.00 [0.44, 1.00] | 0 | 0 | 0 |
| FF-S03 | layer-skip-graph | advisory | 0 | 0 | 0/0 (n/a) | 0/0 (n/a) | 0 | 0 | 0 |

### Blocking misses (0)

None.

### Blocking false alarms (look-alike and clean variants) (0)

None.

### Blocking rows beyond the manifest on violation variants (0)

None.

