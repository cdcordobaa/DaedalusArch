# U6 adjudication sheet: the 9 spec–manifest disagreement rows (C3)

**For the author. 2026-10-18. Verdicts filled 2026-10-19: all 9 rows and N1 ruled `spec`, signed by the author via the decision desk (`ops/review/2026-10-19/decision-desk/answers.json`, items ADJ-1 to ADJ-13 and N1).** The verdicts follow the construct answers Q4 A, Q7 A, Q13 B, Q20 A and Q6 B, so BR-U6-C1 holds (no split group, no `blind` verdict).

## What this sheet is for

Each row below is a blocking row that the **blind manifest** expects and the **spec side** does not. The spec side is the tool under its construct source together with the author manifest. Both say "none" on all 9 rows.

Your verdict sets the **adjudicated development reference**, which is the C3 target in `ops/03-build-list.md`. It does not touch the hold-out. Nobody edits a manifest after the run, and classifying a defect never changes a figure (`Docs/v1.3/holdout-prespec.md:56`, `:91`).

## Sources and conventions

- Numbering follows `Docs/DiagnosticRuns/v1.3-blind-recall-gap-2026-10-18.md`.
- Blind reasons are quoted from the committed `results/v1.3-reference/after-member-facts/adjudication.csv`, column `blind_reason`. That is the only route by which the blind key is read here; `daedalus-sealed/` was not opened.
- "Rec." is the recommendation in `Docs/v1.3/construct-decisions.md`.

## Before you start

**Rule (BR-U6-C1).** Rows that share a question should get the **same** verdict, unless you write a construct reason that differs by row:
- #1 to #4 share Q4.
- #7, #10 and #13 share Q7.

A "blind is right" verdict implies the switch in the last column, with every side effect it has across the set. A "blind is right" verdict without that switch leaves a permanent, declared miss.

**Verdict values:** `spec`, `blind` or `undecided`.
- `spec`: the row leaves the adjudicated reference.
- `blind`: the row stays expected.
- `undecided`: the row stays expected and is flagged in the report.

---

## Group Q4: a layer cycle without a file cycle (rows #1 to #4)

**Shared argument.** The downward edges always exist in these projects, so every upward edge closes a layer-level cycle. On all four rows the closing edge is already a blocking FF-S01 TP, and on #3 and #4 it is also FF-S03. **No file-level cycle exists** on any of the four. The blind reasons say so themselves.

- **For the spec (Q4 A):**
  - [SRS: Clean/Layered, FF-S02] is about the **component** graph, and the sources do not treat a layer as an ADP component.
  - The FF-S02 row would add no fact beyond the FF-S01 row (P2).
- **For the blind:** a layer is a declared grouping, and a cycle on the layer graph is the shape ADP names at that grain.
- **Against the blind reading as applied:**
  - The blind reader applied it to 4 of the many upward edges.
  - Q4 B reports **11 more** blocking rows that the blind key does not list either: clean +3, nestjs +3, hexagonal +5.
  - Taking the reading consistently costs blind precision; taking it on these 4 rows only is a fit.
  - Q4 B scoped to layered alone would close #3 and #4 with no layered false alarm. It is excluded as a tweak, because it has no source reason.
- **If the blind is right:** Q4 B. Effect: blind R 50/64 → 54/64, and blind P 50/54 → 54/69.

| # | Style / variant | Files (sorted pair) | Spec says | Blind manifest says | Verdict | Note |
|---|---|---|---|---|---|---|
| 1 | clean / v01-domain-imports-application-port | `src/application/ports/Clock.ts` ↔ `src/domain/entities/Loan.ts` | FF-S01 and FF-S04 on `Loan.ts → Clock.ts`; no FF-S02 (no file cycle) | FF-S02, blocking (alsoMatches of FF-S01, high): "No file-level cycle (Clock.ts imports nothing) but application<->domain is now cyclic at layer level." | **spec** | ADJ-1, signed 2026-10-19 by the author via the decision desk |
| 2 | clean / v09-dto-depends-on-http-adapter | `src/application/dto/LoanDto.ts` ↔ `src/infrastructure/http/HttpTypes.ts` | FF-S01 on `LoanDto.ts → HttpTypes.ts`; no FF-S02 | FF-S02 (alsoMatches of FF-S01, high): "Layer-level cycle application<->infrastructure; no file-level cycle." | **spec** | ADJ-2, signed 2026-10-19 by the author via the decision desk |
| 3 | layered / v01-gateway-returns-business-money | `src/business/model/Money.ts` ↔ `src/persistence/ProductGateway.ts` | FF-S01 (and today FF-S03) on `ProductGateway.ts → Money.ts`; no FF-S02 | FF-S02 (alsoMatches of FF-S01, high): "the lowest layer must not depend upward … Layer-level cycle business<->persistence." | **spec** | ADJ-3, signed 2026-10-19 by the author via the decision desk |
| 4 | layered / v02-service-renders-view | `src/business/services/OrderService.ts` ↔ `src/presentation/views/OrderView.ts` | FF-S01 (and today FF-S03) on `OrderService.ts → OrderView.ts`; no FF-S02 | FF-S02 (alsoMatches of FF-S01, high): "Layer-level cycle presentation<->business; no file-level cycle." | **spec** | ADJ-4, signed 2026-10-19 by the author via the decision desk |

---

## Group Q7: FF-P03 for a consumer of a concrete adapter (rows #7, #10, #13)

**Shared argument.** In each row something imports or injects a concrete adapter instead of its port. FF-S01, and in hexagonal FF-S03 or FF-S04, already report the edge.

- **For the spec (Q7 A):**
  - [SRS: Clean, FF-P03] and [SRS: Hexagonal, port-adapter] describe the **implementer's** place, not the consumer.
  - The consumer's fault is a direction fault (FF-S01 or FF-S04) or a DIP fault (FF-P02), and those rules already own it (P2).
  - Correction from the verification notes: Martin ch. 11 (DIP) does cover code that uses a concrete class. That supports FF-P02 owning the edge, not FF-P03.
- **For the blind:** a consumer that names the concrete adapter defeats the port, so the pattern breaks at its use site.
- **Row-specific caveat:** for #10 and #13, the blind package had **no `ports/out/` folder**. The hexagonal FF-P03 readings were therefore made without seeing the ports (`construct-decisions.md`, Q7 caveat). This is a construct reason that can differ by row.
- **If the blind is right:** Q7 B. Effect: +3 TPs and **+4 blocking false alarms** (blind P 50/54 → 53/61).

| # | Style / variant | File → target | Spec says | Blind manifest says | Verdict | Note |
|---|---|---|---|---|---|---|
| 7 | nestjs / v07-service-injects-concrete-repository | `src/registrations/registrations.service.ts` → `src/registrations/in-memory-registration.repository.ts` | no FF-P03 (the service is not an implementer); the edge is allowed by the preset order (see #6); FF-P04 advisory reports the service | FF-P03 (alsoMatches of FF-S01, high): "injects the concrete InMemoryRegistrationRepository instead of the REGISTRATION_REPOSITORY port … the domain port is no longer bound." | **spec** | ADJ-7, signed 2026-10-19 by the author via the decision desk |
| 10 | hexagonal / v03-use-case-injects-concrete-adapter | `src/application/services/FindAvailableRoomsService.ts` → `src/adapters/outbound/persistence/InMemoryRoomRepository.ts` | FF-S01 (blocking); FF-S04 under Q6 B; no FF-P03 | FF-P03 (alsoMatches of core-isolation, high): "depends on the concrete InMemoryRoomRepository instead of the RoomRepository port … (Cockburn 2005)." | **spec** | ADJ-10, signed 2026-10-19 by the author via the decision desk |
| 13 | hexagonal / v05-inbound-adapter-reads-outbound-adapter | `src/adapters/inbound/http/RoomController.ts` → `src/adapters/outbound/persistence/InMemoryRoomRepository.ts` | FF-S03 advisory today; FF-S05 blocking under Q5 D; no FF-P03 | FF-P03 (alsoMatches of dependency-direction-graph, high): "A driving adapter depends on a driven adapter … bypassing the application and its ports." | **spec** | ADJ-13, signed 2026-10-19 by the author via the decision desk |

---

## Row #6: Q13, the NestJS layer order

| # | Style / variant | File → target | Spec says | Blind manifest says | Verdict | Note |
|---|---|---|---|---|---|---|
| 6 | nestjs / v07-service-injects-concrete-repository | `src/registrations/registrations.service.ts` → `src/registrations/in-memory-registration.repository.ts` | **allowed**: `presets/nestjs.yaml` declares Controller → Service → Repository ("application services call the repositories in the infrastructure layer directly"). No tool row on this edge; FF-P04 (advisory) only | FF-S01, blocking (primary, high): "application depends on infrastructure and the domain port is no longer bound. Note: registrations.module.ts now provides the class directly." | **spec** | ADJ-6, signed 2026-10-19 by the author via the decision desk |

- **For the spec (Q13 B):**
  - The preset states the order.
  - The NestJS docs constrain DI injection, not file imports, and their TypeORM example injects a repository into a service (verification notes).
  - Under B, v07's defect is DIP only (FF-P02, advisory).
- **For the blind:** ADR-V13-02 calls the NestJS preset "a Clean Architecture layering inside Nest modules". Under Clean, a service must not know the repository class.
- **Against the blind reading:**
  - The Clean order (Q13 C) recovers #6, but it turns the agreed nestjs v02 FF-S01 (repository → response DTO) into a miss. No single layer order makes both blind rows violations.
  - Q13 C also needs Q25 B, because without it nestjs P falls to 10/68.
- **If the blind is right:** Q13 C + Q25 B. Effect: net 50/64 (+1, −1).
- **Either way:** fix the ADR-V13-02 / preset contradiction (Q13 action item).

---

## Row #8: Q20, transitive purity

| # | Style / variant | File → target | Spec says | Blind manifest says | Verdict | Note |
|---|---|---|---|---|---|---|
| 8 | nestjs / v10-domain-policy-holds-repository | `src/domain/registration-policy.ts` → `src/registrations/in-memory-registration.repository.ts` | FF-S01 and FF-S04 (blocking) on this edge; FF-P06 FLOWS_TO (N/A by Q8 B); no FF-P01, because the domain file imports no forbidden package directly | FF-P01 (alsoMatches of FF-S01, high): "imports and instantiates a concrete infrastructure repository; the domain depends outward and, transitively, on @nestjs/common." | **spec** | ADJ-8, signed 2026-10-19 by the author via the decision desk |

- **For the spec (Q20 A):** the transitive part is already a direction fault owned by FF-S01 and FF-S04. Counting it under purity would make every outward edge a purity finding (P2).
- **For the blind:** a domain that reaches a framework through one hop still depends on it at run time.
- **Two further problems with the blind row:**
  1. `@nestjs/common` is **not** in the nestjs preset's FF-P01 `forbidden_imports` (typeorm, express, prisma, sequelize).
  2. The blind row targets the intermediate file, while a transitive purity row would target the package.
- **If the blind is right:** **no switch recovers it.** Q20 B recovers nothing here and adds 14 blocking false alarms. Adding `@nestjs/common` to the list is excluded as a tweak. A `blind` verdict leaves a declared permanent miss.

---

## Note N1: a consequential row, not one of the 9

| # | Style / variant | File → target | Spec says (under Q6 B) | Both manifests say | Verdict | Note |
|---|---|---|---|---|---|---|
| N1 | hexagonal / v02 (domain → application port) | the hex v02 domain file → its application port (the row that `rows.ts` `q6ApplicationCore` drops) | under Q6 B the edge is **inside the core**, so it is not FF-S04; FF-S01 still reports it (Q11 A) | FF-S04 (agreed by both keys) | **spec** | N1, signed 2026-10-19 by the author via the decision desk |

Rule on N1 only if you choose Q6 B. A `spec` verdict removes it from both references. A `blind` verdict (or keeping it) leaves the miss that Q6 B causes: hexagonal 15/18 after the four fixes, or 15/16 after the 9 rows.

---

## Effect of the verdicts (development set, after the four class (b) fixes)

| If you rule… | clean | layered | nestjs | hexagonal | ddd | pooled |
|---|---|---|---|---|---|---|
| all 9 `blind` (no further switch) | 12/14 | 8/10 | 10/13 | 15/18 | 10/10 | 55/65 = 0.85 [0.74, 0.91] |
| all 9 `spec` | 12/12 | 8/8 | 10/10 | 15/16 (15/15 if N1 = `spec`) | 10/10 | 55/56 = 0.98 [0.91, 1.00] |

These are development figures. They are not a reason for any verdict. Decide each group on its construct.

**Signed:** the author, via the decision desk (61 signed answers, `ops/review/2026-10-19/decision-desk/answers.json`). **Date:** 2026-10-19. Transcribed to `results/v1.3-reference/after-member-facts/adjudication-verdicts.csv` (plan Step 5).
