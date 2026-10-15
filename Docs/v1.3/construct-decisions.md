# v1.3 construct decisions (for the author)

**2026-10-15. Status: open, for the author to fill in.** Each question below needs one letter on its `[Answer]:` line. Expect 30 to 45 minutes. The recommended option is listed first in each question.

## What this is

The tool and the two manifests (the author's and the blind one) still disagree after the fix round. This page turns every remaining disagreement into a question about how a rule is defined. It covers:

- all 40 rows of `results/v1.3-reference/after-fixes/adjudication.csv`;
- the 13 ambiguities in the blind summary (`daedalus-sealed/v1.3-blind/blind-out/summary.md`);
- the open items RDQ-1 to RDQ-3, ADR-V13-02, the three tier ADRs proposed in `Docs/v1.3-ddd-notes.md` §2, and FF-DS01.

The result is 25 questions. Questions 1 to 13 move blocking rows. Questions 14 to 25 are small, or are confirmations.

**How to read the numbers.**

- **Where they come from.** Every figure is from the 71-case development set. It shows what is at stake. It is not a validity estimate, and it is not a reason on its own: decide each question on its construct. A tier change still needs an ADR with a construct reason (`rule-tiers.md`).
- **The reference.** For each option, the reference is what both manifests would expect once that option is adopted. Rows both manifests already agree on stay in unless the question is about them. Every other question is held at its recommended option.
- **R and P.** Blocking recall (R) and blocking precision (P), as found/expected and correct/reported, for the styles the question moves.
- **"x → y".** x is the current tool (after-fixes `raw/`). y is the tool after the code change the option implies, assumed to be done exactly. A single figure means the option needs no code change, or only a tier or preset entry.
- **Where to find more.** `construct-decisions-impact.csv` has every question, option, style and both tool states, for blocking rules and for all scored rules.

**Where this lands.** With every recommendation adopted and the current tool, pooled blocking R is 53/56 = 0.95 and P is 53/57 = 0.93. After the implied changes, both are 56/56. For comparison, today the author view is R 56/57 and P 56/56, and the blind view is R 52/67 and P 52/56.

**Precedence used for the recommendations.** When a style's canonical source and a rule's current wording disagree, the source wins (as in `Docs/v1.3-reference-notes.md`, "Precedence"). Where the sources are silent, the recommendation keeps what is already sealed or implemented. Source rows are cited as **[SRS: Style, Rule]** from `Docs/v1.3/style-rule-sources.md`.

## Summary

"Sheet rows" counts rows of the 40-row adjudication sheet. "Other rows" counts rows that both manifests agree on today but that the question puts at stake. "Change" is the work the recommended option implies.

| # | Question | Recommended | Sheet rows | Other rows | Styles | Change |
|---|---|---|---|---|---|---|
| 1 | FF-P06 not applicable to layered (ADR-V13-02)? | A: confirm | 0 | 53 (baseline) | layered | none (done) |
| 2 | Does a type-only import count? | A: yes | 0 | 12 | clean, layered, nestjs, ddd | none |
| 3 | Is a file cycle inside one layer an FF-S02 violation? | A: yes | 0 | 4 | clean, layered, hex | none; state the unit |
| 4 | Is a layer-level cycle with no file cycle FF-S02? | A: no | 4 | 0 | clean, layered | none |
| 5 | Is adapter→adapter blocking, and under which rule? | A: FF-S03, blocking in hex and ddd | 5 | 1 | hex, ddd | tier ADR |
| 6 | Does hexagonal core-isolation cover the application layer? | A: yes | 2 | 1 | hex | template binding |
| 7 | Does FF-P03 cover a consumer of a concrete adapter? | A: no | 3 | 0 | nestjs, hex | none |
| 8 | Do field initialisers count for FF-P06? | A: yes | 0 | 3 | clean, nestjs, hex | tier-note ADR |
| 9 | Is a missing `implements` an FF-P03 violation? | A: FF-P03 yes, FF-P02 no | 4 | 3 | clean, nestjs, hex | none |
| 10 | Which packages does FF-P01 forbid in the layered business layer? | A: web frameworks only | 3 | 0 | layered | preset list |
| 11 | Is domain→application inside the core forbidden? | A: yes | 1 | 3 | hex, ddd | none |
| 12 | Is an upward adjacent import also FF-S03 in layered? | A: no | 2 | 0 | layered | template |
| 13 | NestJS: may services import repositories (RDQ-2)? | A: yes; FF-P04 follows it | 3 | 1 | nestjs | FF-P04 (advisory) |
| 14 | FF-DT03 tier | A: advisory until member facts | 1 | 1 | ddd | tier ADR |
| 15 | FF-DS01 tier | A: advisory | 1 | 1 | ddd | tier row |
| 16 | Add FF-S02 to the DDD preset? | A: yes | 1 | 0 | ddd | preset |
| 17 | DDD public API: literal specifier or resolved target? | A: literal | 1 | 1 | ddd | none (done) |
| 18 | May a DDD ACL import upstream internals? | A: yes (as sealed) | 0 | 1 | ddd | none |
| 19 | Aggregate boundary: does any import of an inner entity count? | A: yes | 0 | 1 | ddd | none |
| 20 | Does domain purity count transitive framework imports? | A: no | 1 | 0 | nestjs | none |
| 21 | FF-DT05 tier | A: advisory (as sealed) | 0 | 1 | ddd | none |
| 22 | Does FF-P02 count sibling-service injection (RDQ-3)? | A: no | 1 | 0 | nestjs (advisory) | template |
| 23 | Does FF-P05 select entities by layer or by name? | A: by layer | 2 | 0 | clean, nestjs (advisory) | template |
| 24 | Is an inward bypass of the use-case layer a finding? | A: no | 5 | 0 | clean, nestjs, hex, layered (advisory or unscored) | none |
| 25 | Files outside the layer model: declare their roles? | A: yes, in the presets | 0 | 0 | nestjs, clean, hex, ddd | preset |

All 40 sheet rows are counted once. The two blind ids outside every compared set (nestjs v02 FF-SO01, ddd v10 FF-P02) are noted under questions 13 and 5.

---

## Q1. FF-P06 is not applicable to layered (ADR-V13-02): confirm?

**Why it matters.** This is the largest swing in the set: the 53 FF-P06 rows the baseline reported in layered (RDQ-1). The fix is already in. The question is whether to keep it.
- A: layered R 8/8, P 8/8.
- B: blocking is unchanged, but layered all-rule precision falls to 8/61.
- C: layered R 8/8, P 8/8 → 8/61. The layered clean variant fails again.

**Literature.** **[SRS: Layered, FF-S01/S03]** (Fowler ch. 1; POSA Layers): a higher layer uses the layer below. The table has no isolated-domain row for Layered. The isolated-domain constraint comes only from **[SRS: Clean, FF-P01]**, **[SRS: Hexagonal, core isolation]** and **[SRS: DDD, isolated domain]**.

**Options.**
- **A (Recommended): confirm.** FF-P06 is not applicable to `layered`, and its tier is unchanged elsewhere. *Reason:* in closed layering a business service holding a gateway is the intended dependency, so no violation exists to report.
- B: keep FF-P06 in layered, but advisory. It would report as advice a dependency the style requires.
- C: revert to the v1.2E behaviour (blocking in layered).

**Example** (layered clean variant, which both manifests call clean):
```ts
export class OrderService {
  constructor(private readonly orders: OrderGateway, private readonly products: ProductGateway) {}
```

[Answer]:

---

## Q2. Does a type-only import (`import type`) count as a dependency?

**Why it matters.** 12 findings rest only on type-only edges, 11 of them blocking under the recommended tiers: clean v10, layered v04 and v08, nestjs v06, and ddd g03, v01, v02, v05 (advisory), v08, v09 (FF-S01 and the cycle of Q16) and v10. DDD is hit hardest. Under B, 7 of its 8 blocking findings would leave the reference.
- A: clean R 13/13, P 13/13; layered 8/8, 8/8; nestjs 11/11, 11/11; ddd 8/8, 8/8.
- B: clean R 12/12, P 12/13 → 12/12; layered 6/6, 6/8 → 6/6; nestjs 10/10, 10/11 → 10/10; ddd R 1/1, P 1/8 → 1/1. Pooled P 45/56 → 45/45.

**Literature.** The sources are silent on TypeScript type imports. **[SRS: Clean, FF-S01]** speaks of *source-code* dependencies, and an `import type` is one: the file does not compile without the other file. The blind annotator counted them too (ambiguity 4).

**Options.**
- **A (Recommended): yes, count them.** *Reason:* the constraint is about what a module knows, not about what survives compilation. A domain entity that types its parameter as `express.Request` knows the web layer.
- B: no. Ignore edges whose every import is `import type`.

**Examples.**
```ts
// clean v10, src/domain/entities/Member.ts (FF-P01)
import type { Request } from 'express';
static fromRequest(request: Request): Member { … }
```
```ts
// ddd v08, billing/application/IssueInvoice.ts (FF-DS02)
import type { Order } from '../../ordering/domain/order/Order.js';
```

[Answer]:

---

## Q3. Does a file cycle inside one layer violate ADP (FF-S02)?

**Why it matters.** There are 4 blocking rows that all three sources report today: clean v03, layered v05 and v06, and hex v11. The blind annotator held them with *low* confidence and "would not fail them on construct grounds" (ambiguity 1). nestjs v04, a cycle across two feature modules, is not in question.
- A: clean R 13/13, P 13/13; layered 8/8, 8/8; hex 16/16, 16/16.
- B: clean R 12/12, P 12/13 → 12/12; layered 6/6, 6/8 → 6/6; hex 15/15, 15/16 → 15/15.
- C: the same as B for blocking. The rows move to advisory.

**Literature.** **[SRS: Clean/Layered, FF-S02]** (Martin ch. 14, ADP) states the rule for *components*. It does not say whether a TypeScript file is a component. The sources are silent on file granularity.

**Options.**
- **A (Recommended): yes.** The unit of FF-S02 is the file (ES module), and the thesis should say so. *Reason:* in TypeScript the file is the unit that is imported and loaded, and cycles between files cause the load-order faults ADP guards against. All five planted cycles were written as violations on that reading.
- B: no. Only cycles that cross a layer or module boundary count.
- C: both count, but an in-layer cycle is advisory.

**Example** (clean v03):
```ts
// src/domain/entities/Loan.ts
import { Member } from './Member';
// src/domain/entities/Member.ts
import { Loan } from './Loan';
```

[Answer]:

---

## Q4. Is a layer-level cycle without a file cycle an FF-S02 violation?

**Why it matters.** There are 4 blind-only blocking rows, sheet rows 0, 5, 7 and 9: clean v01 and v09, and layered v01 and v02. In each, one upward edge closes a cycle between two layers. FF-S01 already reports that edge in all three sources.
- A: clean R 13/13, P 13/13; layered 8/8, 8/8.
- B: clean R 13/15 → 15/15; layered 8/10 → 10/10. P stays 1.00.

**Literature.** **[SRS: Clean/Layered, FF-S02]** is about the component graph. **[SRS: Layered, FF-S01/S03]** already forbids the upward edge. The sources do not treat a layer as an ADP component.

**Options.**
- **A (Recommended): no.** *Reason:* the downward edges always exist, so every upward edge closes a layer cycle. FF-S02 on layers would be FF-S01 counted twice.
- B: yes. Also compute cycles on the layer graph.

**Example** (clean v01):
```ts
// src/domain/entities/Loan.ts: domain imports an application port
import { Clock } from '../../application/ports/Clock';
```

[Answer]:

---

## Q5. Is adapter→adapter a direction violation or a layer skip, and does it block?

**Why it matters.** Sheet rows 27, 28, 30 and 31 cover hex v05 and v06. The tool and the author report FF-S03 `layer-skip-graph`, which is advisory. The blind manifest reports FF-S01 `dependency-direction-graph`, which is blocking. This is the DDD notes' proposed ADR 3. Option A also makes the agreed ddd v10 row (`api → infrastructure`) blocking. Sheet row 39 (ddd v10, FF-P02) is outside the DDD compared set and has no effect.
- A: hex R 16/16, P 16/16; ddd 8/8, 8/8.
- B: hex R 14/16 → 16/16, P 1.00; ddd 7/7.
- C: hex R 14/14; ddd 7/7. The two planted adapter defects do not block.

**Literature.** **[SRS: Hexagonal, port-adapter]** and **[SRS: Hexagonal, core isolation]** (Cockburn 2005): each actor talks to the application through a port, so adapters do not talk to each other. This is a defining constraint. The sealed FF-S03 reason ("hexagonal does not define strict layering") is about skipping a ring, which is not what this template reports.

**Options.**
- **A (Recommended): keep FF-S03 `layer-skip-graph`, made blocking in hexagonal and ddd (ADR).** *Reason:* the template reports an edge between two layers that have no allowed edge in either direction. That is Cockburn's constraint, and it needs only a tier change, no new code.
- B: report it under FF-S01, which needs a template change.
- C: keep it advisory, as sealed.

**Example** (hex v05, `adapters/inbound/http/RoomController.ts`):
```ts
import { InMemoryRoomRepository } from '../../outbound/persistence/InMemoryRoomRepository';
constructor(private readonly findAvailableRooms: FindAvailableRooms,
            private readonly roomStore: InMemoryRoomRepository) {}
```

[Answer]:

---

## Q6. Does hexagonal core-isolation (FF-S04) cover the application layer?

**Why it matters.** Sheet rows 24 and 26 cover hex v03 and v04: application services that import an adapter, which only the blind manifest reports under FF-S04. Option A also removes the agreed FF-S04 row on hex v02 (domain → application port), because under A that edge stays inside the core. FF-S01 still reports it (Q11).
- A: hex R 14/16 → 16/16, P 14/15 → 16/16.
- B: hex R 15/15, P 15/15.

**Literature.** **[SRS: Hexagonal, core isolation]**: "The *application core* … does not depend on adapters." Cockburn's hexagon is the application, and it does not split domain from application. The template today binds only `domain`.

**Options.**
- **A (Recommended): yes.** In hexagonal, the core is domain plus application. *Reason:* this is the source's wording. It also matches how the author already counts domain → adapter edges under both FF-S01 and FF-S04.
- B: no. The core is the domain only, as the template is now.

**Example** (hex v04, `application/services/CancelBookingService.ts`):
```ts
import { HttpError } from '../../adapters/inbound/http/HttpTypes';
if (booking === undefined) throw new HttpError(404, `No booking ${bookingId}`);
```

[Answer]:

---

## Q7. Does FF-P03 / port-adapter-pattern cover a *consumer* of a concrete adapter?

**Why it matters.** Sheet rows 18, 25 and 29 are 3 blind-only blocking rows: nestjs v07, and hex v03 and v05. In each, something injects or imports a concrete adapter. FF-S01 and FF-P02 already report these edges.
- A: nestjs R 11/11; hex 16/16.
- B: nestjs R 11/12 → 12/12; hex 16/18 → 18/18.

**Literature.** **[SRS: Clean, FF-P03]** gives the port's place (inner layer) and the implementation's place (outer layer). **[SRS: Hexagonal, port-adapter]** says secondary adapters implement ports the core defines. Both describe the *implementer*. They are silent on consumers. Caveat: the blind package had no `ports/out/` folder, so its FF-P03 readings in hexagonal were made blind to the ports.

**Options.**
- **A (Recommended): no.** FF-P03 is about where the port and its implementation live. *Reason:* the consumer's fault is a direction fault (FF-S01 or FF-S04) or a DIP fault (FF-P02), and those rules already report it.
- B: yes. Any dependency on a concrete adapter also breaks FF-P03.

**Example** (hex v03, `application/services/FindAvailableRoomsService.ts`):
```ts
import { InMemoryRoomRepository } from '../../adapters/outbound/persistence/InMemoryRoomRepository';
    private readonly rooms: InMemoryRoomRepository,
```

[Answer]:

---

## Q8. FF-P06: does a field initialiser (`= new Impl()`) count?

**Why it matters.** All 3 FF-P06 detections (clean v08, nestjs v10, hex v10) come from the `FLOWS_TO` half, through a field initialiser. The sealed tier row calls that half "near-empty… reported N/A" and says that "only the constructor-injection half is valid". The blind annotator flagged this as ambiguity 11. Read literally, the sealed text would drop all 3.
- A: clean R 13/13; nestjs 11/11; hex 16/16 (P 1.00).
- B: clean R 12/12, P 12/13 → 12/12; nestjs 10/10, 10/11 → 10/10; hex 15/15, 15/16 → 15/15.

**Literature.** No source row covers FF-P06. Its construct, "core isolation of state" (`rule-tiers.md`), rests on **[SRS: Clean, FF-P01]** and **[SRS: Hexagonal, core isolation]**. A domain class that builds and keeps an infrastructure object holds infrastructure state, whether it gets the object from a constructor parameter or a field.

**Options.**
- **A (Recommended): yes.** Amend the "partial" note with an ADR: `FLOWS_TO` is sparse, but what it finds is a correct fact. *Reason:* the construct does not depend on how the object arrives, and nothing in the set suggests that a `FLOWS_TO` row is wrong.
- B: no. Follow the sealed text: report only constructor injection and mark the `FLOWS_TO` half N/A.

**Example** (clean v08, `domain/services/LoanPolicy.ts`):
```ts
import { SystemClock } from '../../infrastructure/system/SystemClock';
export class LoanPolicy {
  private readonly clock = new SystemClock();
```

[Answer]:

---

## Q9. Missing `implements` under structural typing: FF-P03? FF-P02?

**Why it matters.** Three variants drop an `implements` clause and are still wired where the port is expected: clean v06, nestjs v08 and hex v08. FF-P03 there is a blocking row all three sources report. hex v09 is different: the adapter implements an interface it owns. The blind manifest also adds FF-P02 to all four (sheet rows 1, 19, 32, 33). FF-P02 is advisory, so those rows move only all-rule figures (pooled 66/71 → 70/71 under B). This is ambiguity 2.
- A: clean R 13/13; nestjs 11/11; hex 16/16.
- B: blocking is unchanged.
- C: clean R 12/12, P 12/13 → 12/12; nestjs 10/10, 10/11 → 10/10; hex 15/15, 15/16 → 15/15.

**Literature.** **[SRS: Clean, FF-P03]** (Martin ch. 11 and 22): dependency inversion across the boundary. The implementation depends on, and points at, the inner interface. **[SRS: Hexagonal, port-adapter]**: adapters *implement* ports. The sources are silent on structural typing.

**Options.**
- **A (Recommended): FF-P03 yes, FF-P02 no.** *Reason:* without `implements`, the source has no dependency from the implementation to the port, so the inversion is not stated in the code. FF-P02 measures the consumer's injected types, which have not changed.
- B: FF-P03 and FF-P02 both.
- C: neither. Conformance plus wiring is enough.

**Example** (clean v06):
```ts
// was: export class InMemoryLoanRepository implements LoanRepository {
export class InMemoryLoanRepository {
```

[Answer]:

---

## Q10. Does FF-P01 domain purity apply to the business layer in layered, and to which packages?

**Why it matters.** Sheet rows 11 to 13 cover layered v07 (a `typeorm` decorator) and v08 (`express`). The tool and the author report FF-P01. The blind manifest skips FF-P01 in layered and files v08 as FF-S01 (ambiguity 5). These are 2 of layered's 4 blind-view false positives.
- A: layered R 8/8, P 8/9 → 8/8.
- B: layered R 9/9, P 9/9.
- C: layered R 7/8, P 7/9 → 8/8.
- D: layered R 7/7, P 7/9 → 7/7.

**Literature.** **[SRS: Layered]** states no purity rule. Fowler's own data-source patterns for layered systems (Active Record) put persistence in domain objects. **[SRS: Layered, FF-S01/S03]**: lower layers do not use upper ones, so a business service typed on a web framework's request reaches upward.

**Options.**
- **A (Recommended): in layered, FF-P01 forbids web/UI framework packages only.** That means `express` but not `typeorm`. *Reason:* this reports the upward reach the style forbids, without forbidding the persistence coupling the style allows. It is a preset list change.
- B: FF-P01 forbids every declared framework, as now.
- C: FF-P01 does not apply. Map packages to layers and report `express` under FF-S01 instead, which needs a new mechanism.
- D: FF-P01 does not apply, and there is no replacement.

**Examples.**
```ts
// layered v08, business/services/OrderService.ts: reported under A
import type { Request } from 'express';
```
```ts
// layered v07, business/model/Order.ts: allowed under A
import { Entity } from 'typeorm';
@Entity('orders')
```

[Answer]:

---

## Q11. Is domain → application forbidden inside the core (hexagonal, DDD)?

**Why it matters.** This affects the agreed FF-S01 rows on hex v02 and ddd v09, and FF-S04 on hex v02 (see Q6). Sheet row 37 (ddd v09, FF-S04) is outside the DDD compared set. This is ambiguity 10.
- A: hex R 16/16; ddd 8/8.
- B: hex R 15/15, P 15/16 → 15/15; ddd 7/7, 7/8 → 7/7.

**Literature.** **[SRS: DDD, isolated domain]** (Evans ch. 4): the domain is separated from application concerns. **[SRS: Clean, FF-S01]**: entities do not know use cases. **[SRS: Hexagonal]** is silent: Cockburn does not split the inside of the hexagon.

**Options.**
- **A (Recommended): forbidden, by FF-S01, wherever the declaration splits domain from application.** *Reason:* both declarations make that split, and Evans and Martin both put the domain below the application. Leave FF-S04 out of DDD: there it would only repeat FF-S01.
- B: allowed. The core is one unit.

**Example** (ddd v09, `ordering/domain/customer/Customer.ts`):
```ts
import type { PlaceOrderCommand } from '../../application/PlaceOrder.js';
```

[Answer]:

---

## Q12. In layered, is an upward adjacent import *also* an FF-S03 layer skip?

**Why it matters.** Sheet rows 6 and 8 cover layered v01 and v02. `no-layer-skip` fires on every edge that is not allowed, including upward ones, so the tool and the author report FF-S03 next to FF-S01. The blind manifest reports only FF-S01. These are the other 2 of layered's 4 blind-view false positives.
- A: layered R 8/8, P 8/10 → 8/8.
- B: layered R 10/10, P 10/10.

**Literature.** **[SRS: Layered, FF-S01/S03]**: "lower layers do not use upper ones" (FF-S01), and strict layering "also forbids skipping a layer" (FF-S03). A skip passes over an intermediate layer, and an upward use passes over none.

**Options.**
- **A (Recommended): no.** FF-S03 reports only downward edges that pass over a layer. *Reason:* the two clauses are separate constraints, and an upward edge has nothing to skip. Template change: drop edges whose reverse is allowed.
- B: yes. Report both rules, as now.

**Example** (layered v01, `persistence/ProductGateway.ts`):
```ts
import { Money } from '../business/model/Money';
priceOf(sku: string): Money | undefined {
```

[Answer]:

---

## Q13. NestJS: may an application service import a repository class (layer order; RDQ-2)?

**Why it matters.**
- Sheet row 17: nestjs v07, blind-only FF-S01 (blocking).
- Sheet row 16: FF-P04, tool only (advisory).
- The agreed FF-S01 on nestjs v02 (repository → DTO), which flips under C.
- Sheet row 15 (nestjs v02, FF-SO01) is outside the compared set.

This is ambiguity 6b.
- A: nestjs R 11/11, P 11/11. All-rule P 13/14 → 13/13.
- B: the same blocking figures; FF-P04 is kept.
- C: nestjs R 10/11, P 10/11 → 11/11.

**Literature.** **[SRS: NestJS]** (docs, "Modules", "Providers") is silent on layer order. `presets/nestjs.yaml` is explicit: "Controller → Service → Repository … NestJS treats infrastructure as an inner data-access layer that application services call directly." Note that ADR-V13-02 calls the NestJS preset "a Clean Architecture layering", which contradicts this. Correct one or the other.

**Options.**
- **A (Recommended): yes, keep the preset's order.** v07's defect is DIP only (FF-P02, advisory), and FF-P04 must follow the same order. *Reason:* the preset states the order, and the NestJS docs' standard flow agrees with it.
- B: keep the order, but leave FF-P04 as it is.
- C: Clean order, with infrastructure outermost. v07 becomes an FF-S01 violation, and v02 is no longer one.

**Example** (nestjs v07, `registrations/registrations.service.ts`):
```ts
import { InMemoryRegistrationRepository } from './in-memory-registration.repository';
    private readonly registrations: InMemoryRegistrationRepository,
```

[Answer]:

---

## Q14. FF-DT03 value-object immutability: blocking or advisory?

**Why it matters.** g01 (sheet row 34) is the last author-view blocking miss: a `set value` accessor the extractor cannot see (M3). This is the DDD notes' proposed ADR 1.
- A: ddd R 8/8.
- B: ddd R 9/10.
- C: ddd R 9/10 → 10/10.

**Literature.** **[SRS: DDD, value-object immutability]** (Evans ch. 5; Vernon ch. 6): value objects are immutable. The construct is defining, but the tool checks a proxy (setter-named methods), and `rule-tiers.md` calls proxies advisory.

**Options.**
- **A (Recommended): advisory until the extractor records member modifiers.** *Reason:* a blocking rule must be checked as a precise fact. Note: this move comes after g01, but the DDD notes recommended it before the rule was run.
- B: blocking, as sealed, accepting the g01 miss.
- C: blocking, and add member facts (`readonly`, accessors) to the extractor now.

**Example** (ddd g01, `ordering/domain/value-objects/Quantity.ts`):
```ts
private current: number;
set value(v: number) { this.current = v; }
```

[Answer]:

---

## Q15. FF-DS01 bounded-context-modules: blocking or advisory?

**Why it matters.** This affects the agreed row on ddd v07, `src/utils/formatCurrency.ts`. The blind manifest filed it as advisory "OTHER"; sheet row 36 is the blind's FF-C04, which is not compared. FF-DS01 has no row in the sealed `rule-tiers.md`.
- A: ddd R 8/8.
- B: ddd R 9/9.

**Literature.** **[SRS: DDD, bounded-context isolation]** (Evans ch. 14): each model applies inside an explicit boundary. It says nothing about utility code that belongs to no model.

**Options.**
- **A (Recommended): advisory.** Add its row to the tier table by ADR. *Reason:* a stray helper folder breaks no model boundary. FF-DS02 still blocks any cross-context import. The independent reader also saw it as advisory.
- B: blocking, as in the DDD notes.

**Example** (ddd v07, `billing/api/InvoiceController.ts`):
```ts
import { formatCurrency } from '../../utils/formatCurrency.js';
```

[Answer]:

---

## Q16. Should the DDD preset include FF-S02 (cycles)?

**Why it matters.** Sheet row 38: ddd v09 has a real three-file cycle, `PlaceOrder → CustomerRepository → Customer → PlaceOrder`. No DDD rule reports it.
- A: ddd R 7/8 → 8/8.
- B: ddd R 7/7.

**Literature.** **[SRS: Clean/Layered, FF-S02]** lists ADP for Clean and Layered only. The DDD rows are silent on cycles.

**Options.**
- **A (Recommended): yes, add FF-S02 (blocking) to the DDD preset.** *Reason:* ADP is not specific to any style, and the DDD reference uses the same file-level module graph as the others.
- B: no.

**Example:** see Q11. The `import type` of `PlaceOrderCommand` in `Customer.ts` closes the cycle.

[Answer]:

---

## Q17. DDD public API: the literal specifier or the resolved target?

**Why it matters.** g02 (sheet row 35) imports `GetOrderSummary` through `ordering/index.ts`. g03 imports the same file directly. Fix 6 adopted the literal reading (g02 silent, g03 reported). This is ambiguity 7.
- A: ddd R 8/8.
- B: ddd R 8/9 → 9/9.
- C: blocking is the same as A.

**Literature.** **[SRS: DDD, bounded-context isolation]**: integration goes "through a published interface". The source does not say whether a barrel re-export is that interface.

**Options.**
- **A (Recommended): literal.** An import through the declared barrel is public. *Reason:* the context declares its API by what its barrel exports, so the published interface is a declaration.
- B: resolved. g02 is a violation too.
- C: literal, plus a new advisory rule for a barrel that publishes an application service.

**Example** (ddd g02, `billing/api/InvoiceController.ts`):
```ts
import type { GetOrderSummary } from '../../ordering/index.js';  // g03: '../../ordering/application/GetOrderSummary.js'
```

[Answer]:

---

## Q18. May a DDD anti-corruption layer import upstream internals?

**Why it matters.** n01 is a near-miss that all three sources call clean today. Under B it becomes a blocking FF-DS02 violation. This is ambiguity 8.
- A: ddd R 8/8.
- B: ddd R 8/9 → 9/9.

**Literature.** **[SRS: DDD, bounded-context isolation]**: integration is "translated by an anticorruption layer". In Evans ch. 14, the ACL still talks to the other context through its existing interface. The sealed tier row says "imports only through the declared public API *or ACL*".

**Options.**
- **A (Recommended): yes, as sealed.** The ACL folder is exempt. *Reason:* the sealed rule text grants the exemption, and changing it now would be a construct change made after seeing the data. A spec can opt into the strict reading by declaring no ACL folder.
- B: no. The ACL also goes through the public API (Evans, strictly).

**Example** (ddd n01, `billing/acl/OrderingAcl.ts`):
```ts
import { OrderId } from '../../ordering/domain/order/value-objects/OrderId.js';
```

[Answer]:

---

## Q19. Aggregate boundary: does any import of an inner entity from outside count?

**Why it matters.** This affects the agreed blocking FF-DT01 row on ddd v01. The blind annotator gave it medium confidence, because Evans allows *transient* references (ambiguity 9).
- A: ddd R 8/8.
- B: ddd R 7/7, P 7/8 → 7/7.

**Literature.** **[SRS: DDD, aggregate boundary]** (Evans ch. 6; Vernon ch. 10): outside objects may *hold* references only to the root. Transient use of an inner entity handed out by the root is allowed. An import edge cannot tell holding from transient use.

**Options.**
- **A (Recommended): yes, any import counts.** *Reason:* a static check cannot see how long a reference lives. In v01 the root never hands lines out, so the import can only come from bypassing it.
- B: no. Report only references that are kept, which the tool cannot check.

**Example** (ddd v01, `ordering/application/GetOrderSummary.ts`):
```ts
import type { OrderLine } from '../domain/order/OrderLine.js';
```

[Answer]:

---

## Q20. Does domain purity (FF-P01) count transitive framework dependencies?

**Why it matters.** Sheet row 22: on nestjs v10 the blind manifest adds FF-P01, because the domain policy imports a repository that imports `@nestjs/common`. FF-S01, FF-S04 and FF-P06 already report that edge.
- A: nestjs R 11/11.
- B: nestjs R 11/12 → 12/12.

**Literature.** **[SRS: Clean, FF-P01]** and **[SRS: DDD, isolated domain]**: the domain does not depend on frameworks. They are silent on transitive dependencies.

**Options.**
- **A (Recommended): no, direct imports only.** *Reason:* the transitive part is already a direction fault. Counting it again under purity would make every outward edge also a purity finding.
- B: yes.

**Example** (nestjs v10, `domain/registration-policy.ts`):
```ts
import { InMemoryRegistrationRepository } from '../registrations/in-memory-registration.repository';
private readonly history = new InMemoryRegistrationRepository();
```

[Answer]:

---

## Q21. FF-DT05 domain-event placement: advisory or blocking?

**Why it matters.** This affects the agreed row on ddd v05 (DDD notes, proposed ADR 2).
- A: ddd R 8/8.
- B: ddd R 9/9.

**Literature.** `style-rule-sources.md` has no DDD row for event placement. The sealed tier table calls it a placement guideline. The DDD notes cite Vernon ch. 8 (events are domain objects), which is outside the table.

**Options.**
- **A (Recommended): advisory, as sealed.** *Reason:* the table lists no defining-constraint source, and the stakes are low.
- B: blocking.

**Example** (ddd v05):
```ts
// src/billing/application/InvoiceIssued.ts
export class InvoiceIssued implements DomainEvent {
```

[Answer]:

---

## Q22. Does FF-P02 count sibling-service injection (RDQ-3)?

**Why it matters.** Sheet row 14 is nestjs n03, the last near-miss false positive: it has a 0.75 ratio of injected interfaces. FF-P02 is advisory, so this has no blocking effect.
- A: nestjs all-rule P 13/14 → 13/13.
- B: nestjs all-rule P 14/14.

**Literature.** No row covers FF-P02. **[SRS: Clean, FF-P03]** cites DIP (Martin ch. 11) for dependencies *across a boundary*. **[SRS: NestJS]** (Providers) shows injecting a service of the same layer as standard practice.

**Options.**
- **A (Recommended): no.** Count only dependencies on another layer. *Reason:* DIP protects policy from detail. A same-layer service is neither policy nor detail to its sibling.
- B: yes, count all constructor dependencies, as now.

**Example** (nestjs n03, `registrations/registrations.service.ts`):
```ts
import { WorkshopsService } from '../workshops/workshops.service';
    private readonly workshopsService: WorkshopsService,
```

[Answer]:

---

## Q23. FF-P05: is an "entity" selected by its layer or by a name suffix?

**Why it matters.** Sheet rows 2 and 20, clean v07 and nestjs v09, are expected by both manifests. The tool misses them because `Loan` and `Workshop` have no `Entity` suffix (TDC-1). The rule is advisory.
- A: clean all-rule R 15/16 → 16/16; nestjs 12/13 → 13/13.
- B: no change.

**Literature.** No row covers FF-P05; the tier table calls it a guideline. The declarations define entities by folder (`domain/entities/**`, `src/domain/**`).

**Options.**
- **A (Recommended): by the declared domain layer (entity role or folder).** *Reason:* the declaration is the architect's statement, and a suffix is only a naming habit.
- B: by name suffix, as now.

**Example** (clean v07, `infrastructure/http/LoanController.ts`):
```ts
import { Loan } from '../../domain/entities/Loan';
const loan: Loan | undefined = await this.loanRepository.findById(…);
```

[Answer]:

---

## Q24. Is an *inward* bypass of the use-case layer a finding?

**Why it matters.** Five blind-only rows, none blocking:
- sheet row 23, hex n01 (FF-S03);
- sheet rows 3 and 4, clean v07 (FF-P04, and FF-S03, which is not compared);
- sheet row 21, nestjs v09 (FF-S03, not compared);
- sheet row 10, layered v03, "lower-layer type exposed through the business API", which no rule covers.

This is ambiguity 3.
- A: no blocking effect; pooled all-rule R 66/67.
- B: hex all-rule R 17/18 → 18/18; clean 16/17 → 17/17.

**Literature.** **[SRS: Clean, FF-S01]** constrains direction only. `rule-tiers.md` gives the FF-S03 reason: Clean and Hexagonal allow skipping inward. **[SRS: Hexagonal, port-adapter]** says actors talk through ports. Using a domain value type is not talking to the application.

**Options.**
- **A (Recommended): no.** It is not FF-S03 or FF-P04. The controller-to-entity case belongs to FF-P05 (Q23). An exposed lower-layer type is out of scope. *Reason:* the styles permit inward dependencies, and these rows would flood every case.
- B: yes, as an advisory FF-S03 finding when an adapter or controller does work that belongs to a use case.

**Example** (hex n01, `adapters/inbound/http/RoomController.ts`):
```ts
import { DateRange } from '../../../domain/model/DateRange';
DateRange.parse(String(request.query['checkIn']), String(request.query['checkOut']));
```

[Answer]:

---

## Q25. Files outside the layer model: should the presets declare their roles?

**Why it matters.** No row moves on the development set: the tool is silent on all of these today. The cases are:
- second composition roots: clean n01 `TestLibraryApp.ts`, hex n02 `testContainer.ts`;
- NestJS `*.module.ts` files wiring repository implementations;
- `main.ts`, the DDD `index.ts` and `contracts/**`, and `utils/**`;
- the NestJS `src/domain/waitlist.repository.ts`, which matches both a domain directory and an infrastructure file pattern.

These are ambiguities 6a, 6c, 12 and 13. They stay silent only because nothing binds those files. A Study 2 project could fire on them.

**Literature.** The table is silent. **[SRS: NestJS]**: providers are wired in modules. Martin ch. 26 ("Main") is outside the table.

**Options.**
- **A (Recommended): declare them in the presets.**
  - A `composition-root` role, exempt from the layer rules (main, test containers, `*.module.ts`).
  - Directory beats file pattern, as the NestJS preset's comment already says.
  - Unassigned files are not checked by layer rules. In DDD, FF-DS01 reports them (Q15).

  *Reason:* the behaviour is then stated, rather than an accident of the globs.
- B: leave as is.

**Example** (nestjs n02, `src/domain/waitlist.repository.ts`):
```ts
/** A port that lives in src/domain/ but uses the *.repository.ts file name the preset maps to infrastructure. */
export interface WaitlistRepository {
```

[Answer]:

---

## After answering

- Record the answers in an ADR, for example ADR-V13-03 "construct decisions". Tier moves (Q5, Q14, Q15, Q21) and the FF-P06 note (Q8) need a construct reason each, which the recommendation lines above give.
- Implement the changes the answers imply on a new branch, then re-run `ue-score.ts`. Fill the `adjudication` column of `adjudication.csv` from these answers.
- The numbers here are not to be quoted as validity. The sealed hold-out set measures validity.

*Method.* The rows were dumped from `results/v1.3-reference/after-fixes/` (`raw/`, the author-manifests, the blind manifests with `alsoMatches` expanded, cycles keyed on their file set), with the same matching as `scripts/v1.3/lib/compare.ts`. The figures were then re-scored offline per option. With every question at its current behaviour, the script reproduces the after-fixes report exactly (author R 56/57, P 56/56; blind R 52/67, P 52/56). Type-only status was read from the blind graph's `typeOnly` flags.
