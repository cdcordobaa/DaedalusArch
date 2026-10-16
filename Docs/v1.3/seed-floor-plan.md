# v1.3 seed-floor plan: closing the gap to 20 planted violations per style

**2026-10-16. Status: plan only. No variant is created by this document.** It addresses V13-TV-S2 in `Docs/v1.3/threats-register.md`. The floor is `Docs/v1.3/validation-protocol.md:51`: "At least 20 planted violations per style, using variants plus the existing mutation operators."

## 1. How the current counts were taken

- **Source.** The committed reference manifests:
  - `tests/fixtures/v1.3-reference/<style>/variants/*/expected-findings.json`: fields `kind`, `plants`, `expectedFindings`;
  - for DDD, `variants/*/variant.json` (`rule`) and `expected-findings.json` (`findings`);
  - the per-rule true positives in `results/v1.3-reference/after-member-facts/scores.json`, view `author-cycle-normalised`.

  Nothing was re-run or re-scored.
- **Unit.** A *planted violation* is one violating variant, which plants exactly one primary rule (`plants` / `rule`). Collateral expected findings, such as FF-S04 next to FF-S01, are listed but do not add to the plant count.
- **Not counted.**
  - Clean variants and near-misses.
  - The DDD probe g02, a negative.
  - The SO4 MO-* seeds: Study 1 bases, in-sample, mostly NestJS (V13-TV-I7, V13-TV-E2).
  - The #79 anti-pattern seeds, which probe the judge, not the blocking rules.

## 2. Current counts against the floor

| Style | Planted variants | Primary rule is blocking | Expected blocking findings (author view, corrected) | Floor | Gap (variants) |
|---|---|---|---|---|---|
| clean-architecture | 10 | 7 | 12 | 20 | **10** |
| layered | 9 | 9 | 11 | 20 | **11** |
| nestjs | 10 | 7 | 10 | 20 | **10** |
| hexagonal | 11 | 7 | 12 | 20 | **9** |
| ddd | 12 | 8 (+1 FF-DS01, tier deferred under Q15) | 9 (8 without FF-DS01) | 20 | **8** |
| **total** | **52** | **38** | **54** | 100 | **48** |

### Per style and rule, planted variants today

`plants` field. Blocking rules are in bold.

| Style | Variants per rule |
|---|---|
| clean-architecture | **FF-S01** 3 (v01, v02, v09) · **FF-S02** 1 (v03) · **FF-P01** 2 (v04, v10) · **FF-P03** 1 (v06) · FF-P02 1 (v05, advisory) · FF-P05 1 (v07, advisory) · FF-P06 1 (v08, field half: N/A) |
| layered | **FF-S01** 2 (v01, v02) · **FF-S03** 3 (v03, v04, v09) · **FF-S02** 2 (v05, v06) · **FF-P01** 2 (v07, v08) |
| nestjs | **FF-S01** 3 (v01, v02, v03) · **FF-S02** 1 (v04) · **FF-P01** 2 (v05, v06) · **FF-P03** 1 (v08) · FF-P02 1 (v07, advisory) · FF-P05 1 (v09, advisory) · FF-P06 1 (v10, field half: N/A) |
| hexagonal | **FF-S01** 3 (v01, v02, v04) · **FF-P01** 1 (v07) · **FF-P03** 2 (v08, v09) · **FF-S02** 1 (v11) · FF-P02 1 (v03, advisory; collateral FF-S01) · FF-S03 2 (v05, v06, advisory in hexagonal) · FF-P06 1 (v10, field half: N/A) |
| ddd | **FF-DT01** 1 (v01) · **FF-DT02** 1 (v02) · **FF-DT03** 2 (v03, g01) · **FF-DT04** 1 (v04) · **FF-DS02** 2 (v08, g03) · **FF-S01** 1 (v09) · FF-DT05 1 (v05, advisory) · FF-DT06 1 (v06, advisory) · FF-DS01 1 (v07, deferred) · FF-S03 1 (v10) |

### Gaps the counts hide

These drive the choices in §4:

1. **The FF-P06 constructor-injection half has 0 seeds in every style.** It is the only half `rule-tiers.md:30` calls valid (V13-TV-C2).
2. **No reference variant uses a dynamic `import()`.** `dynamicImports` is untested on reference projects (`Docs/DiagnosticRuns/v1.3-graph-fidelity-2026-10-14.md:125`). Its only evidence is the in-sample SO4 MO-X01 seeds.
3. **No violation reaches its target through a barrel** outside DDD g03. ADR-V13-01 (literal and resolved views) is tested on violations only there.
4. **Type-only violations** (Q2, contested) exist only for framework imports: clean v10, nestjs v06, layered v04 and v08. None crosses layers among the project's own files.
5. **FF-S02 has 1 seed** in clean, nestjs and hexagonal. All 5 existing cycles (clean v03, hexagonal v11, layered v05 and v06, nestjs v04) are 2-file cycles **inside one layer**, the construct Q3 contests. No cross-layer cycle is planted anywhere.

## 3. Rules for writing the new variants

These follow `role-separation-plan.md` and V13-TV-I4:

- **One primary defect per variant.** Each variant is a patch on the clean project (overlay for DDD), like the existing ones, and must compile with the project's `tsconfig.json`.
- **No comment in the added code.** No "VIOLATION", "Allowed" or explanatory comment. The plant description lives only in `variant.json` / `expected-findings.json`.
- **Neutral directory names**, `v11`, `v12`, …, with no descriptive suffix. The descriptive name in the tables below goes into `variant.json` as `title`.
- **Framework imports use packages the project already declares.** For the four patch styles that is `types/vendor.d.ts`: `typeorm`, `express`, `@nestjs/common`, `@nestjs/core`. DDD resolves from the repository's `node_modules`, as v04 does. Where a name is missing from the ambient block, the variant adds it to `vendor.d.ts` and says so.
- **Keys.**
  - K-C: a Claude agent that did not write the variant.
  - K-G: Gemini, `role-separation-plan.md` §4.1.
  - Both are written before the tool runs on the variant. The author does not key.
- **Contested constructs** are marked with their question (Q2 type-only, Q3 in-layer cycle, Q6 hexagonal core, Q9 structural typing, Q10 FF-P01 in layered, Q19 transient references). Write them after the question is answered. If the answer makes the construct not applicable, the variant becomes a near-miss and is replaced by an uncontested one of the same rule.
- **This is a development round.** The results are development-set numbers. They never feed the sealed hold-out, and they need a new hold-out before any validity claim (`validation-protocol.md:62`).

## 4. The 48 variants

Each row gives:
- **Rule**: the primary planted rule, plus the expected co-findings.
- **Shape**: the edit.
- **File**: the file the defect sits in (the importing or declaring file).
- **Adds**: which gap of §2 it closes.

### 4.1 clean-architecture (10 → 20)

| Id | Rule | Shape | File | Adds | Q |
|---|---|---|---|---|---|
| c-v11 | FF-P06 (constructor half); + FF-S01, FF-S04 | The domain service takes the infrastructure `SystemClock` as a constructor parameter and stores it | `src/domain/services/FineCalculator.ts` → `src/infrastructure/system/SystemClock.ts` | gap 1 | |
| c-v12 | FF-P06 (constructor half); + FF-S01, FF-S04 | The entity's constructor receives `SequentialIdGenerator` (infrastructure) to mint its own id | `src/domain/entities/Member.ts` → `src/infrastructure/system/SequentialIdGenerator.ts` | gap 1 | |
| c-v13 | FF-S02; + FF-S01 | A cross-layer 2-file cycle: the DTO imports an HTTP type, and the HTTP types import the DTO | `src/application/dto/LoanDto.ts` ↔ `src/infrastructure/http/HttpTypes.ts` | gap 5 | |
| c-v14 | FF-S02 | A 3-file cycle among use cases: Borrow → Return → ListOverdue → Borrow (helper reuse) | `src/application/use-cases/{BorrowBookUseCase,ReturnBookUseCase,ListOverdueLoansUseCase}.ts` | gap 5 (3-file) | Q3 |
| c-v15 | FF-S01 | A use case loads the clock lazily with `await import('../../infrastructure/system/SystemClock')` | `src/application/use-cases/ReturnBookUseCase.ts` | gap 2 | |
| c-v16 | FF-S01 | A new barrel `src/infrastructure/persistence/index.ts` re-exports `InMemoryBookRepository`; the use case imports it from `'../../infrastructure/persistence'` | `src/application/use-cases/RegisterBookUseCase.ts` | gap 3 | |
| c-v17 | FF-S01; + FF-S04 | The domain error imports a status-code constant exported by the HTTP error mapper | `src/domain/errors/DomainError.ts` → `src/infrastructure/http/ErrorMapper.ts` | domain → outermost ring by a constant, not a class | |
| c-v18 | FF-S01; + FF-S04 | A value object names an application DTO with `import type { LoanDto }` (cross-layer, project-internal, type-only) | `src/domain/value-objects/LoanPeriod.ts` → `src/application/dto/LoanDto.ts` | gap 4 | Q2 |
| c-v19 | FF-P03 | The repository interface moves out of the domain into `src/infrastructure/persistence/MemberRepository.ts` next to its implementation; the domain copy is deleted, and use cases import the moved interface | `src/infrastructure/persistence/MemberRepository.ts` (delete `src/domain/repositories/MemberRepository.ts`) | second FF-P03 shape (port misplaced, not missing) | |
| c-v20 | FF-P01 | `@Injectable()` from `@nestjs/common` on a domain service (a DI annotation inside a business object) | `src/domain/services/LoanPolicy.ts` | second FF-P01 framework (DI, not ORM or HTTP) | |

### 4.2 layered (9 → 20)

Layer order, bottom to top: `persistence` → `business` → `presentation`.

| Id | Rule | Shape | File | Adds | Q |
|---|---|---|---|---|---|
| l-v10 | FF-S01 | The data layer throws the business error type | `src/persistence/Database.ts` → `src/business/errors/BusinessError.ts` | upward use by an error type | |
| l-v11 | FF-S01 | A persistence gateway imports a presentation HTTP type (upward by two layers) | `src/persistence/CustomerGateway.ts` → `src/presentation/http/HttpTypes.ts` | upward skip | Q12 |
| l-v12 | FF-S01 | A business model names a presentation type with `import type` | `src/business/model/Product.ts` → `src/presentation/http/HttpTypes.ts` | gap 4 | Q2 |
| l-v13 | FF-S01 | A business service loads the router lazily with `await import('../../presentation/Router')` | `src/business/services/OrderService.ts` | gap 2 | |
| l-v14 | FF-S01 | A new presentation barrel `src/presentation/index.ts` re-exports `OrderView`; the factory imports `'../presentation'` | `src/business/ServiceFactory.ts` | gap 3 | |
| l-v15 | FF-S03 | A controller imports a gateway through a new barrel `src/persistence/index.ts` | `src/presentation/http/CatalogController.ts` | gap 3 (skip via barrel) | |
| l-v16 | FF-S03 | The HTTP error handler imports a `DatabaseError` class newly exported by the database module | `src/presentation/http/ErrorHandling.ts` → `src/persistence/Database.ts` | skip by an error type | |
| l-v17 | FF-S03 | A controller loads a gateway lazily with `await import('../../persistence/OrderGateway')` | `src/presentation/http/OrderController.ts` | gap 2 (skip) | |
| l-v18 | FF-S02; + FF-S01 | A cross-layer cycle: the business `Order` imports `OrderRecord` (allowed direction), and `OrderRecord` imports `Order` back | `src/business/model/Order.ts` ↔ `src/persistence/records/OrderRecord.ts` | cross-layer cycle | |
| l-v19 | FF-S02 | A 3-file cycle among business services: OrderService → PricingPolicy → CatalogService → OrderService | `src/business/services/{OrderService,PricingPolicy,CatalogService}.ts` | 3-file, in-layer | Q3 |
| l-v20 | FF-P01 | `@Injectable()` from `@nestjs/common` on a business service | `src/business/services/PricingPolicy.ts` | FF-P01 in layered with a DI framework | Q10 |

### 4.3 nestjs (10 → 20)

| Id | Rule | Shape | File | Adds | Q |
|---|---|---|---|---|---|
| n-v11 | FF-P06 (constructor half); + FF-S01, FF-S04 | The minimal pair of v10: the domain policy receives `InMemoryRegistrationRepository` as a constructor parameter, not a field initialiser | `src/domain/registration-policy.ts` → `src/registrations/in-memory-registration.repository.ts` | gap 1 (paired with the field-half v10) | |
| n-v12 | FF-P06 (constructor half); + FF-S01, FF-S04 | The domain entity's constructor takes `InMemoryWorkshopRepository` to check capacity | `src/domain/workshop.ts` → `src/workshops/in-memory-workshop.repository.ts` | gap 1 | |
| n-v13 | FF-S01; + FF-S04 | A domain entity imports an application service to call a helper | `src/domain/attendee.ts` → `src/attendees/attendees.service.ts` | domain → application | |
| n-v14 | FF-S01; + FF-S04 | A domain entity lazily imports a repository with `await import('../registrations/in-memory-registration.repository')` | `src/domain/registration.ts` | gap 2 | |
| n-v15 | FF-S01; + FF-S04 | A new DTO barrel `src/workshops/dto/index.ts`; the domain imports `WorkshopResponseDto` from `'../workshops/dto'` | `src/domain/workshop.ts` | gap 3 | |
| n-v16 | FF-S01; + FF-S04 | The domain error imports the exception filter (domain → infrastructure, `src/common/filters/**`) | `src/domain/domain-error.ts` → `src/common/filters/domain-error.filter.ts` | domain → infrastructure, non-repository | |
| n-v17 | FF-S02 | Two services import each other (the NestJS `forwardRef` pattern) | `src/workshops/workshops.service.ts` ↔ `src/registrations/registrations.service.ts` | a framework-typical cycle | Q3 |
| n-v18 | FF-P03 | The registration repository interface moves into the infrastructure file next to its implementation; `src/domain/registration-repository.ts` is deleted | `src/registrations/in-memory-registration.repository.ts` | second FF-P03 shape | |
| n-v19 | FF-P01 | A domain entity throws `NotFoundException` from `@nestjs/common` (added to the ambient block if missing) | `src/domain/registration.ts` | FF-P01 by a framework exception | |
| n-v20 | FF-P01 | A domain entity names `Repository` from `typeorm` with `import type` | `src/domain/workshop.ts` | gap 4 (framework, type-only) | Q2 |

### 4.4 hexagonal (11 → 20)

| Id | Rule | Shape | File | Adds | Q |
|---|---|---|---|---|---|
| h-v12 | FF-P06 (constructor half); + FF-S01, FF-S04 | The domain service receives `FakePaymentGateway` (outbound adapter) as a constructor parameter | `src/domain/services/PriceCalculator.ts` → `src/adapters/outbound/payment/FakePaymentGateway.ts` | gap 1 (pair of v01 and v10) | |
| h-v13 | FF-S01; + FF-S04 | The domain model imports the inbound port's view type | `src/domain/model/Booking.ts` → `src/application/ports/in/BookingView.ts` | domain → application port | Q6 |
| h-v14 | FF-S01 | An application service imports a constant from an outbound adapter (not injected) | `src/application/services/CancelBookingService.ts` → `src/adapters/outbound/notification/OutboxNotificationAdapter.ts` | application → adapter by a constant | |
| h-v15 | FF-S01 | An application service loads a repository adapter lazily with `await import(...)` | `src/application/services/FindAvailableRoomsService.ts` → `src/adapters/outbound/persistence/InMemoryRoomRepository.ts` | gap 2 | |
| h-v16 | FF-S01; + FF-S04 | A new barrel `src/adapters/inbound/http/index.ts` re-exports `HttpTypes`; the domain imports through it | `src/domain/model/Money.ts` | gap 3 | |
| h-v17 | FF-S01; + FF-S04 | A domain error imports an exit-code constant from the CLI adapter | `src/domain/errors/BookingError.ts` → `src/adapters/inbound/cli/BookingCli.ts` | domain → inbound adapter | |
| h-v18 | FF-P03 | The `GuestRepository` port moves from `application/ports/out/` into the adapter folder (`src/adapters/outbound/persistence/GuestRepository.ts`); the services import it there | `src/adapters/outbound/persistence/GuestRepository.ts` | third FF-P03 shape (port in the adapter ring) | |
| h-v19 | FF-P01 | The domain model is mapped with `Entity` and `Column` from `typeorm` | `src/domain/model/Room.ts` | FF-P01 by ORM (v07 was a DI decorator) | |
| h-v20 | FF-S02; + FF-S01 | A port imports its adapter's record type, and the adapter imports the port: a cross-ring cycle | `src/application/ports/out/BookingRepository.ts` ↔ `src/adapters/outbound/persistence/InMemoryBookingRepository.ts` | gap 5 | |

### 4.5 ddd (12 → 20)

| Id | Rule | Shape | File | Adds | Q |
|---|---|---|---|---|---|
| d-v11 | FF-DT01 | The billing API names the inner entity `InvoiceLine` | `src/billing/api/InvoiceController.ts` → `src/billing/domain/invoice/InvoiceLine.ts` | FF-DT01 in the second context | |
| d-v12 | FF-DT01 | The published-language contract names the inner entity with `import type { OrderLine }` | `src/ordering/contracts/OrderSummary.ts` → `src/ordering/domain/order/OrderLine.ts` | type-only reference | Q2, Q19 |
| d-v13 | FF-DT02 | `InvoiceLineRepository` for the inner entity, inside the Invoice module | `src/billing/domain/invoice/InvoiceLineRepository.ts` | FF-DT02 in the second context | |
| d-v14 | FF-DT03 | The shared-kernel value object gains a mutator method that assigns `this.amount` (mutator clause; v03 and g01 cover field, setter and accessor) | `src/shared-kernel/value-objects/Money.ts` | FF-DT03 mutator clause in the shared kernel | Q14 |
| d-v15 | FF-DT04 | The aggregate root imports `Injectable` from `@nestjs/common` | `src/ordering/domain/order/Order.ts` | FF-DT04 by a DI framework (v04 was a serialiser) | |
| d-v16 | FF-DS02 | Ordering's application imports billing's internal value object `InvoiceId` (the reverse direction of v08) | `src/ordering/application/PlaceOrder.ts` → `src/billing/domain/invoice/value-objects/InvoiceId.ts` | FF-DS02 in the other direction | |
| d-v17 | FF-DS02 | Billing infrastructure lazily imports ordering's repository with `await import(...)` | `src/billing/infrastructure/InMemoryInvoiceRepository.ts` → `src/ordering/infrastructure/InMemoryOrderRepository.ts` | gap 2 | |
| d-v18 | FF-S01 | The aggregate root imports its infrastructure repository (domain → infrastructure inside a context) | `src/billing/domain/invoice/Invoice.ts` → `src/billing/infrastructure/InMemoryInvoiceRepository.ts` | FF-S01 domain → infrastructure (v09 was domain → application) | |

## 5. What reaching the floor does and does not buy

- **Per-style counts.** After the 48 variants, every style has 20 planted violations. The blocking-primary counts are clean 17, layered 20, nestjs 17, hexagonal 16 and ddd 16 (17 if FF-DS01 is made blocking under Q15). The rest of each style is advisory or N/A primaries kept from today.
- **The lower bound still cannot pass.** With 20 expected findings and no miss, the 95% Wilson lower bound is 0.84. Reaching 0.90 needs n ≥ 35 per style (`holdout-prespec.md:73`). The floor makes the per-style point estimate less noisy. It does not make "validated" possible on its own (V13-TV-S1).
- **Contested constructs.** Eleven of the 48 depend on an open construct question (marked Q). If the author's answers make some not applicable, replace each with an uncontested variant of the same rule, so the count holds.
- **Development data.** These variants measure the tool on new development data. A validity claim on them needs a new hold-out (`validation-protocol.md:62`).
- **Cost.** 48 patches or overlays, each with two keys (K-C and K-G) and one tool run. On the current harness that is one `ue-baseline-live` run over 119 cases instead of 71, plus 48 × 2 key-writer calls (estimate with `--estimate` first).
