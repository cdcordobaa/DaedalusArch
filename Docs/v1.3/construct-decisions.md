# v1.3 construct decisions (for the author)

**2026-10-15, revision 1 (adversarial review applied). Status: open, for the author to fill in.** Each question below needs one letter on its `[Answer]:` line.

**Order of options.** In every question, option A is the status quo: what the after-fixes tool does today. Where the sealed text says something else, the question says so. The change options follow. The recommendation comes after the options, on its own line.

## What this is

The tool and the two manifests (the author's and the blind one) still disagree after the fix round. This page turns every remaining disagreement into a question about how a rule is defined. It covers:

- all 40 rows of `results/v1.3-reference/after-fixes/adjudication.csv`;
- the 13 ambiguities in the blind summary (`daedalus-sealed/v1.3-blind/blind-out/summary.md`);
- the open items RDQ-1 to RDQ-3, ADR-V13-02, the three tier ADRs proposed in `Docs/v1.3-ddd-notes.md` §2, and FF-DS01.

The result is 25 questions. Questions 1 to 13 move blocking rows. Questions 14 to 25 are small, or are confirmations.

## Principles (confirm these first)

Two principles decide several questions at once. Confirm or reject each before answering the questions it governs.

| Principle | Statement | Decides | Bears on (does not decide alone) |
|---|---|---|---|
| **P1** | When the canonical sources are silent for a style, the rule is **not applicable** in that style. It is not kept by default, and no style-specific substitute is invented. | Q1 (FF-P06 in layered), Q10 (FF-P01 in layered) | Q16: the sources list ADP for Clean and Layered only. ADP (Martin 2017, ch. 14) is stated for components in general, not for a style, so P1 does not decide Q16. Read strictly, P1 would answer Q16 with A (no). |
| **P2** | **One edge, one rule.** An edge is reported under the rule whose construct it breaks, and not again under a second rule. | Q4 (layer cycles), Q7 (FF-P03 consumers), Q12 (FF-S03 on upward edges), Q20 (transitive purity), Q11 (no FF-S04 in DDD) | Q5 (the new rule replaces FF-S03 for that edge). Q6: option B reports an application → adapter edge under both FF-S01 and FF-S04, which P2 argues against. The existing domain → adapter overlap of FF-S01 and FF-S04 has the same problem. |

**Precedence.** When a style's canonical source and a rule's current wording disagree, the source wins (as in `Docs/v1.3-reference-notes.md`, "Precedence"). Source rows are cited as **[SRS: Style, Rule]** from `Docs/v1.3/style-rule-sources.md`.

## Decide these yourself (high stakes)

These move blocking rows on a construct the sources leave open, or they redefine a rule's unit or scope. Do not accept the recommendation by default.

- **Q3.** Is an in-layer file cycle blocking?
- **Q5.** Adapter → adapter: tier and rule id.
- **Q10.** FF-P01 in layered.
- **Q2.** Type-only imports.
- **Q8 + Q14, as one policy.** A sealed tier that assumes a fact the extractor lacks.
- **Q6.** Hexagonal core = domain + application?
- **Q13.** NestJS layer order.

**Safe defaults** (the recommendation can be accepted unless you disagree on reading): Q1, Q4, Q7, Q9, Q11, Q12, Q17 to Q24.

**Default acceptable only with caveats:** Q15 (deferred, not decided), Q16 and Q25 (each needs one development-set run before the hold-out; see the questions).

## How to read the numbers

- **Where they come from.** Every figure is from the 71-case development set. It shows what is at stake. It is not a validity estimate, and it is not a reason on its own: decide each question on its construct. A tier change still needs an ADR with a construct reason (`rule-tiers.md`).
- **Where they are.** In each question the figures come last, after the literature and the options. `construct-decisions-impact.csv` has every question, option, style and both tool states, for blocking rules and for all scored rules. Its option letters follow the order on this page.
- **The reference.** For each option, the reference is what both manifests would expect once that option is adopted. Rows both manifests already agree on stay in unless the question is about them. Every other question is held at its **revision 0** recommendation. Revision 1 changed the recommendation for Q3, Q5, Q8, Q10, Q14 and Q15, and the figures were not re-scored for that. A figure in another question can therefore be off by the rows those six questions move.[^1]
- **R and P.** Blocking recall (R) and blocking precision (P), as found/expected and correct/reported, for the styles the question moves.
- **"x → y".** x is the current tool (after-fixes `raw/`). y is the tool after the code change the option implies, assumed to be done exactly. A single figure means the option needs no code change, or only a tier or preset entry.

[^1]: Revision 0 reported that adopting every recommendation yields 56/56 after the implied changes. That holds by construction: the reference is redefined per option, so the tool after the change matches it. It is not evidence for any option.

## Summary

"Sheet rows" counts rows of the 40-row adjudication sheet. "Other rows" counts rows that both manifests agree on today but that the question puts at stake. "Change" is the work the recommended option implies. A bold question number marks a changed recommendation in revision 1.

| # | Question | A (status quo) | Recommended | Sheet rows | Other rows | Styles | Change |
|---|---|---|---|---|---|---|---|
| 1 | FF-P06 not applicable to layered (ADR-V13-02)? | not applicable | A: confirm | 0 | 53 (baseline) | layered | none (done) |
| 2 | Does a type-only import count? | yes | A: yes | 0 | 12 | clean, layered, nestjs, ddd | none |
| **3** | Is a file cycle inside one layer an FF-S02 violation? | yes, blocking | C: advisory in-layer | 0 | 4 | clean, layered, hex | tier split by ADR; cycle classification |
| 4 | Is a layer-level cycle with no file cycle FF-S02? | no | A: no | 4 | 0 | clean, layered | none |
| **5** | Is adapter→adapter blocking, and under which rule? | FF-S03, advisory | D: new rule id, blocking in hex and ddd | 5 | 1 | hex, ddd | ADR, new template id |
| 6 | Does hexagonal core-isolation cover the application layer? | no (domain only) | B: yes | 2 | 1 | hex | template binding |
| 7 | Does FF-P03 cover a consumer of a concrete adapter? | no | A: no | 3 | 0 | nestjs, hex | none |
| **8** | Do field initialisers count for FF-P06? | yes (tool); sealed text says N/A | B: sealed tier, FLOWS_TO half N/A | 0 | 3 | clean, nestjs, hex | report N/A half |
| 9 | Is a missing `implements` an FF-P03 violation? | FF-P03 yes, FF-P02 no | A | 4 | 3 | clean, nestjs, hex | none |
| **10** | Does FF-P01 apply to the layered business layer? | yes, every declared framework | C: not applicable; FF-S01 package mapping if declared | 3 | 0 | layered | disable in layered; mapping mechanism |
| 11 | Is domain→application inside the core forbidden? | yes | A: yes | 1 | 3 | hex, ddd | none |
| 12 | Is an upward adjacent import also FF-S03 in layered? | yes | B: no | 2 | 0 | layered | template |
| 13 | NestJS: may services import repositories (RDQ-2)? | yes; FF-P04 as is | B: yes; FF-P04 follows it | 3 | 1 | nestjs | FF-P04 (advisory); fix ADR-V13-02 text |
| **14** | FF-DT03 tier | blocking | A: blocking; accessor half N/A | 1 | 1 | ddd | report N/A half |
| **15** | FF-DS01 tier | blocking (no sealed row) | A: defer (keep) | 1 | 1 | ddd | none now |
| 16 | Add FF-S02 to the DDD preset? | no | B: yes, after one dev-set run | 1 | 0 | ddd | preset |
| 17 | DDD public API: literal specifier or resolved target? | literal | A: literal | 1 | 1 | ddd | none (done) |
| 18 | May a DDD ACL import upstream internals? | yes (as sealed) | A: yes | 0 | 1 | ddd | none |
| 19 | Aggregate boundary: does any import of an inner entity count? | yes | A: yes (stricter than Evans) | 0 | 1 | ddd | none |
| 20 | Does domain purity count transitive framework imports? | no | A: no | 1 | 0 | nestjs | none |
| 21 | FF-DT05 tier | advisory (as sealed) | A: advisory | 0 | 1 | ddd | none |
| 22 | Does FF-P02 count sibling-service injection (RDQ-3)? | yes | B: no (a narrowing) | 1 | 0 | nestjs (advisory) | template |
| 23 | Does FF-P05 select entities by layer or by name? | by name suffix | B: by layer | 2 | 0 | clean, nestjs (advisory) | template |
| 24 | Is an inward bypass of the use-case layer a finding? | no | A: no | 5 | 0 | clean, nestjs, hex, layered (advisory or unscored) | none |
| 25 | Files outside the layer model: declare their roles? | no | B: yes, after one dev-set run | 0 | 0 | nestjs, clean, hex, ddd | preset |

All 40 sheet rows are counted once. The two blind ids outside every compared set (nestjs v02 FF-SO01, ddd v10 FF-P02) are noted under questions 13 and 5.

---

## Q1. FF-P06 is not applicable to layered (ADR-V13-02): confirm?

**Why it matters.** This is the largest swing in the set: the 53 FF-P06 rows the baseline reported in layered (RDQ-1). The fix is already in. The question is whether to keep it. Sealed v1.2E behaviour (option C) was blocking in layered.

**Literature.** **[SRS: Layered, FF-S01/S03]** (Fowler ch. 1; POSA Layers): a higher layer uses the layer below. The table has no isolated-domain row for Layered. The isolated-domain constraint comes only from **[SRS: Clean, FF-P01]**, **[SRS: Hexagonal, core isolation]** and **[SRS: DDD, isolated domain]**.

**Options.**
- **A: confirm (status quo).** FF-P06 is not applicable to `layered`, and its tier is unchanged elsewhere. *Reason:* in closed layering a business service holding a gateway is the intended dependency, so there is no violation to report.
- **B: keep FF-P06 in layered, but advisory.** *Reason:* a reader may still want to see where business code holds persistence state, as advice rather than as a verdict.
- **C: revert to the v1.2E behaviour (blocking in layered).** *Reason:* it keeps the rule set identical across styles and matches the registered v1.2E scoring.

**Recommendation: A**, because the source states no isolated-domain constraint for Layered (P1), and B would report as advice a dependency the style requires.

**Effect on the development set.**
- A: layered R 8/8, P 8/8.
- B: blocking is unchanged, but layered all-rule precision falls to 8/61.
- C: layered R 8/8, P 8/8 → 8/61. The layered clean variant fails again.

**Example** (layered clean variant, which both manifests call clean):
```ts
export class OrderService {
  constructor(private readonly orders: OrderGateway, private readonly products: ProductGateway) {}
```

[Answer]:

---

## Q2. Does a type-only import (`import type`) count as a dependency?

**Why it matters.** 12 findings rest only on type-only edges, 11 of them blocking under the recommended tiers: clean v10, layered v04 and v08, nestjs v06, and ddd g03, v01, v02, v05 (advisory), v08, v09 (FF-S01 and the cycle of Q16) and v10. DDD is hit hardest.

**Literature.** The sources are silent on TypeScript type imports. **[SRS: Clean, FF-S01]** speaks of *source-code* dependencies, and an `import type` is one: the file does not compile without the other file. The blind annotator counted them too (ambiguity 4).

**Options.**
- **A: yes, count them (status quo).** *Reason:* the constraint is about what a module knows, not about what survives compilation. A domain entity that types its parameter as `express.Request` knows the web layer.
- **B: no. Ignore edges whose every import is `import type`.** *Reason:* a type-only edge leaves no runtime dependency, so it cannot cause load-order or deployment coupling.

**Recommendation: A**, because the sources speak of source-code dependencies, and a type-only import is one: the importing file states knowledge of the other module.

**Effect on the development set.** Under B, 7 of DDD's 8 blocking findings leave the reference.
- A: clean R 13/13, P 13/13; layered 8/8, 8/8; nestjs 11/11, 11/11; ddd 8/8, 8/8.
- B: clean R 12/12, P 12/13 → 12/12; layered 6/6, 6/8 → 6/6; nestjs 10/10, 10/11 → 10/10; ddd R 1/1, P 1/8 → 1/1. Pooled P 45/56 → 45/45.

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

**Why it matters.** There are 4 blocking rows that all three sources report today: clean v03, layered v05 and v06, and hex v11. The blind annotator held them with *low* confidence and "would not fail them on construct grounds" (ambiguity 1). nestjs v04, a cycle across two feature modules, is not in question, and neither is the ddd v09 cycle of Q16, which crosses application and domain.

**Literature.** **[SRS: Clean/Layered, FF-S02]** (Martin 2017, ch. 13 and 14, ADP) defines the principle over *components*, the units of release and deployment. A TypeScript file is not a component in Martin's sense. So a file-level cycle inside one layer is a proxy for ADP, and `rule-tiers.md` makes a proxy advisory.

**Options.**
- **A: yes, blocking (status quo).** The unit of FF-S02 is the file (ES module). *Reason:* in TypeScript the file is the unit that is imported and loaded, and cycles between files cause the load-order faults ADP guards against.
- **B: no. Only cycles that cross a layer or module boundary count.** *Reason:* Martin states ADP over components, and a layer or a feature module is the nearest declared component; an in-layer cycle is outside the rule.
- **C: both count, but an in-layer cycle is advisory.** Cross-layer and cross-component cycles stay blocking. *Reason:* the in-layer file cycle is a proxy for ADP, so it is reported as advice; a cycle across declared components is the defining fact.

**Recommendation: C**, because Martin defines ADP over components, not files, so by the rule-tiers principle an in-layer file cycle is a proxy (advisory), while a cycle across layers or components is the construct itself (blocking). The thesis should state the unit.

**Effect on the development set.**
- A: clean R 13/13, P 13/13; layered 8/8, 8/8; hex 16/16, 16/16.
- B: clean R 12/12, P 12/13 → 12/12; layered 6/6, 6/8 → 6/6; hex 15/15, 15/16 → 15/15.
- C: clean R 12/12, P 12/12; layered 6/6, 6/6; hex 15/15, 15/15. The 4 rows move to advisory, so all-rule figures do not change.

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

**Literature.** **[SRS: Clean/Layered, FF-S02]** is about the component graph. **[SRS: Layered, FF-S01/S03]** already forbids the upward edge. The sources do not treat a layer as an ADP component.

**Options.**
- **A: no (status quo).** *Reason:* the downward edges always exist, so every upward edge closes a layer cycle. FF-S02 on layers would be FF-S01 counted twice.
- **B: yes. Also compute cycles on the layer graph.** *Reason:* a layer is a declared grouping, and a cycle on the layer graph is the shape ADP names at that grain.

**Recommendation: A**, because the layer cycle adds no fact beyond the upward edge FF-S01 already reports (P2).

**Effect on the development set.**
- A: clean R 13/13, P 13/13; layered 8/8, 8/8.
- B: clean R 13/15 → 15/15; layered 8/10 → 10/10. P stays 1.00.

**Example** (clean v01):
```ts
// src/domain/entities/Loan.ts: domain imports an application port
import { Clock } from '../../application/ports/Clock';
```

[Answer]:

---

## Q5. Is adapter→adapter a direction violation or a layer skip, and does it block?

**Why it matters.** Sheet rows 27, 28, 30 and 31 cover hex v05 and v06. The tool and the author report FF-S03 `layer-skip-graph`, which is advisory. The blind manifest reports FF-S01 `dependency-direction-graph`, which is blocking. This is the DDD notes' proposed ADR 3. Making the edge blocking in ddd also makes the agreed ddd v10 row (`api → infrastructure`) blocking. Sheet row 39 (ddd v10, FF-P02) is outside the DDD compared set and has no effect.

**Literature.** **[SRS: Hexagonal, port-adapter]** and **[SRS: Hexagonal, core isolation]** (Cockburn 2005): each actor talks to the application through a port, so adapters do not talk to each other. This is a defining constraint. The sealed FF-S03 reason ("hexagonal does not define strict layering") is about skipping a ring, which is not what this template reports. FF-S03 is advisory outside layered by that reason, so carrying a blocking adapter constraint under the same id would give one id two constructs with opposite tier logic.

**Options.**
- **A: keep FF-S03 `layer-skip-graph`, advisory (status quo, as sealed).** *Reason:* the sealed row tiers this template advisory, and changing it is a construct change made after seeing the data.
- **B: keep FF-S03, made blocking in hexagonal and ddd (ADR).** *Reason:* the template already reports an edge between two layers with no allowed edge in either direction, which is Cockburn's constraint.
- **C: report it under FF-S01, blocking.** *Reason:* FF-S01 is the blocking dependency rule, and an edge to a layer with no allowed edge is a forbidden dependency.
- **D: report it under a new rule id (for example an `adapter-isolation` rule in the hexagonal library), blocking in hexagonal and ddd.** *Reason:* the edge breaks a constraint of its own (adapters talk only through ports), so it gets its own id and tier row, and FF-S03 keeps one meaning.

**Recommendation: D**, because Cockburn makes adapter isolation defining (so blocking), and a separate id keeps FF-S03 a single construct with a single tier logic. C is the acceptable alternative if a new id is not wanted. Under D or C, FF-S03 no longer reports the edge (P2).

**Effect on the development set.**
- A: hex R 14/14; ddd 7/7. The two planted adapter defects do not block.
- B: hex R 16/16, P 16/16; ddd 8/8, 8/8.
- C: hex R 14/16 → 16/16, P 1.00; ddd 7/7.
- D: not scored. By construction it equals B after the change (hex 16/16, ddd 8/8); the current tool emits no rows under the new id, so before the change hex R is 14/16 and ddd R 7/8.

**Example** (hex v05, `adapters/inbound/http/RoomController.ts`):
```ts
import { InMemoryRoomRepository } from '../../outbound/persistence/InMemoryRoomRepository';
constructor(private readonly findAvailableRooms: FindAvailableRooms,
            private readonly roomStore: InMemoryRoomRepository) {}
```

[Answer]:

---

## Q6. Does hexagonal core-isolation (FF-S04) cover the application layer?

**Why it matters.** Sheet rows 24 and 26 cover hex v03 and v04: application services that import an adapter, which only the blind manifest reports under FF-S04. Option B also removes the agreed FF-S04 row on hex v02 (domain → application port), because under B that edge stays inside the core. FF-S01 still reports it (Q11).

**Literature.** **[SRS: Hexagonal, core isolation]**: "The *application core* … does not depend on adapters." Cockburn's hexagon is the application, and it does not split domain from application. The template today binds only `domain`.

**Options.**
- **A: no. The core is the domain only (status quo).** *Reason:* the declaration splits domain from application, and the template binds the layer that the other styles call the isolated domain.
- **B: yes. In hexagonal, the core is domain plus application.** *Reason:* the source names the application core, and Cockburn's hexagon contains the application, so an application service that imports an adapter breaks core isolation.

**Recommendation: B**, because the source's wording is "application core". Note the P2 tension: under B an application → adapter edge is reported by both FF-S01 and FF-S04, as domain → adapter edges already are. If P2 is confirmed, decide which of the two rules owns that edge.

**Effect on the development set.**
- A: hex R 15/15, P 15/15.
- B: hex R 14/16 → 16/16, P 14/15 → 16/16.

**Example** (hex v04, `application/services/CancelBookingService.ts`):
```ts
import { HttpError } from '../../adapters/inbound/http/HttpTypes';
if (booking === undefined) throw new HttpError(404, `No booking ${bookingId}`);
```

[Answer]:

---

## Q7. Does FF-P03 / port-adapter-pattern cover a *consumer* of a concrete adapter?

**Why it matters.** Sheet rows 18, 25 and 29 are 3 blind-only blocking rows: nestjs v07, and hex v03 and v05. In each, something injects or imports a concrete adapter. FF-S01 and FF-P02 already report these edges.

**Literature.** **[SRS: Clean, FF-P03]** gives the port's place (inner layer) and the implementation's place (outer layer). **[SRS: Hexagonal, port-adapter]** says secondary adapters implement ports the core defines. Both describe the *implementer*. They are silent on consumers. Caveat: the blind package had no `ports/out/` folder, so its FF-P03 readings in hexagonal were made blind to the ports.

**Options.**
- **A: no (status quo).** FF-P03 is about where the port and its implementation live. *Reason:* the consumer's fault is a direction fault (FF-S01 or FF-S04) or a DIP fault (FF-P02), and those rules already report it.
- **B: yes. Any dependency on a concrete adapter also breaks FF-P03.** *Reason:* a consumer that names the concrete adapter defeats the port, so the pattern is broken at its use site.

**Recommendation: A**, because the sources describe the implementer only, and the consumer's edge is already owned by another rule (P2).

**Effect on the development set.**
- A: nestjs R 11/11; hex 16/16.
- B: nestjs R 11/12 → 12/12; hex 16/18 → 18/18.

**Example** (hex v03, `application/services/FindAvailableRoomsService.ts`):
```ts
import { InMemoryRoomRepository } from '../../adapters/outbound/persistence/InMemoryRoomRepository';
    private readonly rooms: InMemoryRoomRepository,
```

[Answer]:

---

## Policy for Q8 and Q14: a sealed tier that assumes a fact the extractor lacks

Q8 and Q14 are one question asked twice. In each, the sealed tier assumes a fact that the extractor does not record, or records only sparsely: `FLOWS_TO` for FF-P06, member modifiers and accessors for FF-DT03. Answer them with one policy.

**Recommended policy.** Keep the sealed tier. Report the uncovered half as **N/A**, with its denominator (the cases where the missing fact would be needed) and the label "recall unestimated". Do not re-validate the uncovered half with the rows that happen to agree: agreement on a few rows is a precision observation, and `rule-tiers.md` does not move tiers on precision.

If you choose a different policy, apply it to both questions.

## Q8. FF-P06: does a field initialiser (`= new Impl()`) count?

**Why it matters.** All 3 FF-P06 detections (clean v08, nestjs v10, hex v10) come from the `FLOWS_TO` half, through a field initialiser. The sealed tier row calls that half "near-empty… reported N/A" and says that "only the constructor-injection half is valid". The current tool nevertheless scores those detections as blocking. The blind annotator flagged this as ambiguity 11.

**Literature.** No source row covers FF-P06. Its construct, "core isolation of state" (`rule-tiers.md`), rests on **[SRS: Clean, FF-P01]** and **[SRS: Hexagonal, core isolation]**. A domain class that builds and keeps an infrastructure object holds infrastructure state, whether it gets the object from a constructor parameter or a field.

**Options.**
- **A: yes, score them as blocking (status quo in the tool; contradicts the sealed note).** Amend the "partial" note by ADR. *Reason:* the construct does not depend on how the object arrives, so a field initialiser is the same breach as constructor injection.
- **B: follow the sealed text.** The constructor-injection half is blocking; the `FLOWS_TO` half is reported N/A with its denominator and "recall unestimated", and its 3 detections are listed there, not scored. *Reason:* the sealed row says the half is near-empty, so its recall is unknown and it cannot support a blocking verdict.

**Recommendation: B**, because of the policy above: the sealed tier stands, and the sparse fact is reported as an N/A half rather than validated by its 3 agreeing rows.

**Effect on the development set.**
- A: clean R 13/13; nestjs 11/11; hex 16/16 (P 1.00).
- B: clean R 12/12, P 12/13 → 12/12; nestjs 10/10, 10/11 → 10/10; hex 15/15, 15/16 → 15/15.

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

**Literature.** **[SRS: Clean, FF-P03]** (Martin ch. 11 and 22): dependency inversion across the boundary. The implementation depends on, and points at, the inner interface. **[SRS: Hexagonal, port-adapter]**: adapters *implement* ports. The sources are silent on structural typing.

**Options.**
- **A: FF-P03 yes, FF-P02 no (status quo).** *Reason:* without `implements`, the source has no dependency from the implementation to the port, so the inversion is not stated. FF-P02 measures the consumer's injected types, which have not changed.
- **B: FF-P03 and FF-P02 both.** *Reason:* the missing clause weakens the inversion on both sides, so both the implementer rule and the inversion rule report it.
- **C: neither. Conformance plus wiring is enough.** *Reason:* under structural typing the class satisfies the port, and the wiring shows it is used as one.

**Recommendation: A**, because Martin's inversion is a source-code dependency from the implementation to the interface, and that dependency is absent.

**Effect on the development set.**
- A: clean R 13/13; nestjs 11/11; hex 16/16.
- B: blocking is unchanged.
- C: clean R 12/12, P 12/13 → 12/12; nestjs 10/10, 10/11 → 10/10; hex 15/15, 15/16 → 15/15.

**Example** (clean v06):
```ts
// was: export class InMemoryLoanRepository implements LoanRepository {
export class InMemoryLoanRepository {
```

[Answer]:

---

## Q10. Does FF-P01 domain purity apply to the business layer in layered?

**Why it matters.** Sheet rows 11 to 13 cover layered v07 (a `typeorm` decorator) and v08 (`express`). The tool and the author report FF-P01. The blind manifest skips FF-P01 in layered and files v08 as FF-S01 (ambiguity 5). These are 2 of layered's 4 blind-view false positives.

**Literature.** **[SRS: Layered]** states no purity rule: the style-rule-sources table has no purity row for Layered. Fowler's own data-source patterns for layered systems (Active Record) put persistence in domain objects. **[SRS: Layered, FF-S01/S03]**: lower layers do not use upper ones, so a business service typed on a web framework's request reaches upward. By the precedence rule, the source wins over the rule's current wording, as in Q1.

**Options.**
- **A: FF-P01 forbids every declared framework in the business layer (status quo).** *Reason:* the preset declares the business layer as the domain kind, and FF-P01 is blocking wherever a domain kind is declared.
- **B: FF-P01 forbids web/UI framework packages only** (`express`, not `typeorm`). *Reason:* it reports the upward reach the style forbids without forbidding the persistence coupling the style allows.
- **C: FF-P01 is not applicable to layered. Packages are handled by FF-S01 through a package-to-layer mapping, where the spec declares one.** *Reason:* the source has no purity rule for layered, and the upward reach it does forbid is a direction fact, which belongs to FF-S01.
- **D: FF-P01 is not applicable, and there is no replacement.** *Reason:* the source has no purity rule for layered, and a package import is outside what the layered rules check.

**Recommendation: C**, because the sources are silent on purity for Layered (P1) and the source wins over the rule wording. B would invent a layered-specific package list that no source states. Without a declared package-to-layer mapping, C reduces to D. The mapping is a new mechanism.

**Effect on the development set.**
- A: layered R 9/9, P 9/9.
- B: layered R 8/8, P 8/9 → 8/8.
- C: layered R 7/8 → 8/8, P 7/9 → 8/8 (with `express` mapped to the presentation layer).
- D: layered R 7/7, P 7/9 → 7/7.

**Examples.**
```ts
// layered v08, business/services/OrderService.ts: under C, FF-S01 if express is mapped to presentation
import type { Request } from 'express';
```
```ts
// layered v07, business/model/Order.ts: not reported under C or D
import { Entity } from 'typeorm';
@Entity('orders')
```

[Answer]:

---

## Q11. Is domain → application forbidden inside the core (hexagonal, DDD)?

**Why it matters.** This affects the agreed FF-S01 rows on hex v02 and ddd v09, and FF-S04 on hex v02 (see Q6). Sheet row 37 (ddd v09, FF-S04) is outside the DDD compared set. This is ambiguity 10.

**Literature.** **[SRS: DDD, isolated domain]** (Evans ch. 4): the domain is separated from application concerns. **[SRS: Clean, FF-S01]**: entities do not know use cases. **[SRS: Hexagonal]** is silent: Cockburn does not split the inside of the hexagon.

**Options.**
- **A: forbidden, by FF-S01, wherever the declaration splits domain from application (status quo).** FF-S04 stays out of DDD. *Reason:* both declarations make that split, and Evans and Martin both put the domain below the application.
- **B: allowed. The core is one unit.** *Reason:* Cockburn does not split the hexagon, so an edge inside it is not a boundary crossing.

**Recommendation: A**, because the declaration states the split and the sources that address it (Evans, Martin) put the domain below; FF-S04 in DDD would only repeat FF-S01 (P2).

**Effect on the development set.**
- A: hex R 16/16; ddd 8/8.
- B: hex R 15/15, P 15/16 → 15/15; ddd 7/7, 7/8 → 7/7.

**Example** (ddd v09, `ordering/domain/customer/Customer.ts`):
```ts
import type { PlaceOrderCommand } from '../../application/PlaceOrder.js';
```

[Answer]:

---

## Q12. In layered, is an upward adjacent import *also* an FF-S03 layer skip?

**Why it matters.** Sheet rows 6 and 8 cover layered v01 and v02. `no-layer-skip` fires on every edge that is not allowed, including upward ones, so the tool and the author report FF-S03 next to FF-S01. The blind manifest reports only FF-S01. These are the other 2 of layered's 4 blind-view false positives.

**Literature.** **[SRS: Layered, FF-S01/S03]**: "lower layers do not use upper ones" (FF-S01), and strict layering "also forbids skipping a layer" (FF-S03). A skip passes over an intermediate layer, and an upward use passes over none.

**Options.**
- **A: yes. Report both rules (status quo).** *Reason:* the edge is not in the allowed set, and strict layering allows only adjacent downward edges, which this edge is not.
- **B: no. FF-S03 reports only downward edges that pass over a layer.** *Reason:* the two clauses are separate constraints, and an upward edge has nothing to skip. Template change: drop edges whose reverse is allowed.

**Recommendation: B**, because the source states two clauses, and an upward edge breaks only the first (P2).

**Effect on the development set.**
- A: layered R 10/10, P 10/10.
- B: layered R 8/8, P 8/10 → 8/8.

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

**Literature.** **[SRS: NestJS]** (docs, "Modules", "Providers") is silent on layer order. `presets/nestjs.yaml` is explicit: "Controller → Service → Repository … NestJS treats infrastructure as an inner data-access layer that application services call directly." ADR-V13-02 says the opposite: it calls the NestJS preset "a Clean Architecture layering inside Nest modules".

**Options.**
- **A: keep the preset's order, and leave FF-P04 as it is (status quo).** *Reason:* the preset states the order, and FF-P04 is advisory, so its mismatch with the order costs no verdict.
- **B: keep the preset's order, and make FF-P04 follow it.** v07's defect is then DIP only (FF-P02, advisory). *Reason:* the preset states the order, the NestJS docs' standard flow agrees, and an advisory rule should not contradict the declared order.
- **C: Clean order, with infrastructure outermost.** v07 becomes an FF-S01 violation, and v02 is no longer one. *Reason:* ADR-V13-02 treats the NestJS preset as Clean layering, and under Clean the service must not know the repository class.

**Recommendation: B**, because the preset states the order and the NestJS docs agree with it.

**Action item (before sealing, whichever option is chosen).** Fix the contradiction: either correct ADR-V13-02's claim that the NestJS preset is "a Clean Architecture layering" (under A or B), or correct the preset comment (under C). ADR-V13-02 uses that claim to apply the Clean reasoning for FF-P06 to NestJS, so check that its FF-P06 conclusion still holds once the claim is fixed.

**Effect on the development set.**
- A: nestjs R 11/11, P 11/11; all-rule P 13/14.
- B: the same blocking figures; all-rule P 13/14 → 13/13.
- C: nestjs R 10/11, P 10/11 → 11/11.

**Example** (nestjs v07, `registrations/registrations.service.ts`):
```ts
import { InMemoryRegistrationRepository } from './in-memory-registration.repository';
    private readonly registrations: InMemoryRegistrationRepository,
```

[Answer]:

---

## Q14. FF-DT03 value-object immutability: blocking or advisory?

**Why it matters.** g01 (sheet row 34) is the last author-view blocking miss: a `set value` accessor the extractor cannot see (M3). This is the DDD notes' proposed ADR 1. It falls under the policy for Q8 and Q14 above. A cloud unit is adding member facts (`readonly`, accessors) to the extractor now.

**Literature.** **[SRS: DDD, value-object immutability]** (Evans ch. 5; Vernon ch. 6): value objects are immutable. The construct is defining. The sealed row checks it "as a declaration fact (readonly, no setters)", and the extractor records only part of that fact (setter-named methods). The DDD notes recommended the advisory move before the rule was run, and this page first raised it after g01.

**Options.**
- **A: blocking, as sealed (status quo).** The half the extractor cannot see (accessors, `readonly`) is reported N/A with its denominator and "recall unestimated"; g01 is listed there. *Reason:* the construct is defining, so the sealed tier stands, and the missing fact is reported as a known gap.
- **B: advisory until the extractor records member modifiers.** *Reason:* a blocking rule must be checked as a precise fact, and today part of the fact is not recorded.
- **C: blocking, with member facts (`readonly`, accessors) added to the extractor.** *Reason:* the construct is defining, and with the facts recorded the rule checks it in full.

**Recommendation: A now, becoming C once the member facts land**, because of the policy above. When the cloud unit's member facts are merged, the N/A half closes and FF-DT03 blocks in full; that needs no tier ADR, only a note that the N/A half is now covered.

**Effect on the development set.**
- A: ddd R 9/10 as scored today. Under the N/A reporting, g01 is listed in the N/A half instead of counted as a miss.
- B: ddd R 8/8.
- C: ddd R 9/10 → 10/10.

**Example** (ddd g01, `ordering/domain/value-objects/Quantity.ts`):
```ts
private current: number;
set value(v: number) { this.current = v; }
```

[Answer]:

---

## Q15. FF-DS01 bounded-context-modules: blocking or advisory?

**Why it matters.** This affects the agreed row on ddd v07, `src/utils/formatCurrency.ts`. The blind manifest filed it as advisory "OTHER"; sheet row 36 is the blind's FF-C04, which is not compared. FF-DS01 has no row in the sealed `rule-tiers.md`. The tool tiers it blocking, from the DDD library notes (`Docs/v1.3-ddd-notes.md` §2, written before validation).

**Literature.** **[SRS: DDD, bounded-context isolation]** (Evans 2003, ch. 14): each model applies inside an explicit boundary. Evans ch. 14, SHARED KERNEL: code shared between contexts must be explicitly designated as shared. So a shared helper that lies in no context and is not declared as a shared kernel is undesignated shared code. Whether that is a defining breach or a placement guideline is not settled by the sources.

**Options.**
- **A: keep it blocking (status quo), and defer the tier decision.** Revisit it with hold-out evidence, and decide it on construct. *Reason:* Evans requires shared code to be designated, so the current tier has a construct reading, and one case is too little to settle it.
- **B: advisory, with its own row in the tier table by ADR.** *Reason:* a stray helper folder breaks no model boundary, and FF-DS02 still blocks any cross-context import.

**Recommendation: A (defer)**, because Evans's Shared Kernel gives the blocking reading a construct basis but does not settle it, and a single development-set case should not move the tier.

**Caveat.** Under A, a rule with no sealed row can fail a verdict, so the integration-notes invariant "only rules the sealed table names blocking can fail a verdict" does not hold literally. State that in the ADR, or report FF-DS01 findings separately in the hold-out until the decision is made.

**Effect on the development set.**
- A: ddd R 9/9.
- B: ddd R 8/8.

**Example** (ddd v07, `billing/api/InvoiceController.ts`):
```ts
import { formatCurrency } from '../../utils/formatCurrency.js';
```

[Answer]:

---

## Q16. Should the DDD preset include FF-S02 (cycles)?

**Why it matters.** Sheet row 38: ddd v09 has a real three-file cycle, `PlaceOrder → CustomerRepository → Customer → PlaceOrder`. No DDD rule reports it. The cycle crosses application and domain, so under Q3's recommendation it would be blocking.

**Literature.** **[SRS: Clean/Layered, FF-S02]** lists ADP for Clean and Layered only. The DDD rows are silent on cycles. Martin states ADP for components in general (see P1).

**Options.**
- **A: no (status quo).** *Reason:* the DDD sources state no acyclicity constraint, so the DDD rule set does not include one.
- **B: yes, add FF-S02 (blocking) to the DDD preset.** *Reason:* ADP is not specific to any style, and the DDD reference uses the same file-level module graph as the others.

**Recommendation: B**, because ADP is stated for components in general, not for a style.

**Caveat.** B adds a rule to a preset after the development set was scored. Run it **once** on the development set before the hold-out, with no second tuning loop. Anything surprising goes into an ADR, not into code.

**Effect on the development set.**
- A: ddd R 7/7.
- B: ddd R 7/8 → 8/8.

**Example:** see Q11. The `import type` of `PlaceOrderCommand` in `Customer.ts` closes the cycle.

[Answer]:

---

## Q17. DDD public API: the literal specifier or the resolved target?

**Why it matters.** g02 (sheet row 35) imports `GetOrderSummary` through `ordering/index.ts`. g03 imports the same file directly. Fix 6 adopted the literal reading (g02 silent, g03 reported). This is ambiguity 7.

**Literature.** **[SRS: DDD, bounded-context isolation]**: integration goes "through a published interface". The source does not say whether a barrel re-export is that interface.

**Options.**
- **A: literal (status quo).** An import through the declared barrel is public. *Reason:* the context declares its API by what its barrel exports, so the published interface is a declaration.
- **B: resolved. g02 is a violation too.** *Reason:* what crosses the boundary is the target file, and re-exporting an internal file does not make it a published interface.
- **C: literal, plus a new advisory rule for a barrel that publishes an application service.** *Reason:* it keeps the declared API authoritative while flagging a barrel that exposes more than a model.

**Recommendation: A**, because the published interface is what the context declares, and the barrel is that declaration.

**Effect on the development set.**
- A: ddd R 8/8.
- B: ddd R 8/9 → 9/9.
- C: blocking is the same as A.

**Example** (ddd g02, `billing/api/InvoiceController.ts`):
```ts
import type { GetOrderSummary } from '../../ordering/index.js';  // g03: '../../ordering/application/GetOrderSummary.js'
```

[Answer]:

---

## Q18. May a DDD anti-corruption layer import upstream internals?

**Why it matters.** n01 is a near-miss that all three sources call clean today. Under B it becomes a blocking FF-DS02 violation. This is ambiguity 8.

**Literature.** **[SRS: DDD, bounded-context isolation]**: integration is "translated by an anticorruption layer". In Evans ch. 14, the ACL still talks to the other context through its existing interface. The sealed tier row says "imports only through the declared public API *or ACL*".

**Options.**
- **A: yes, as sealed (status quo).** The ACL folder is exempt. *Reason:* the sealed rule text grants the exemption, and a spec can opt into the strict reading by declaring no ACL folder.
- **B: no. The ACL also goes through the public API.** *Reason:* in Evans the ACL translates what the other context publishes, so it has no licence to reach inside it.

**Recommendation: A**, because the sealed text grants the exemption, and changing it now would be a construct change made after seeing the data.

**Effect on the development set.**
- A: ddd R 8/8.
- B: ddd R 8/9 → 9/9.

**Example** (ddd n01, `billing/acl/OrderingAcl.ts`):
```ts
import { OrderId } from '../../ordering/domain/order/value-objects/OrderId.js';
```

[Answer]:

---

## Q19. Aggregate boundary: does any import of an inner entity from outside count?

**Why it matters.** This affects the agreed blocking FF-DT01 row on ddd v01. The blind annotator gave it medium confidence, because Evans allows *transient* references (ambiguity 9).

**Literature.** **[SRS: DDD, aggregate boundary]** (Evans ch. 6; Vernon ch. 10): outside objects may *hold* references only to the root. Transient use of an inner entity handed out by the root is allowed. An import edge cannot tell holding from transient use.

**Options.**
- **A: yes, any import counts (status quo).** This is **stricter than Evans** (transient references are allowed in Evans ch. 6). *Reason:* a static check cannot see how long a reference lives, so it reports every outside import.
- **B: no. Report only references that are kept.** *Reason:* that is Evans's rule as written, though the tool cannot check it today.

**Recommendation: A, labelled in the thesis as stricter than Evans**, because the tool cannot tell holding from transient use, and in v01 the root never hands lines out, so the import can only come from bypassing it.

**Effect on the development set.**
- A: ddd R 8/8.
- B: ddd R 7/7, P 7/8 → 7/7.

**Example** (ddd v01, `ordering/application/GetOrderSummary.ts`):
```ts
import type { OrderLine } from '../domain/order/OrderLine.js';
```

[Answer]:

---

## Q20. Does domain purity (FF-P01) count transitive framework dependencies?

**Why it matters.** Sheet row 22: on nestjs v10 the blind manifest adds FF-P01, because the domain policy imports a repository that imports `@nestjs/common`. FF-S01, FF-S04 and FF-P06 already report that edge.

**Literature.** **[SRS: Clean, FF-P01]** and **[SRS: DDD, isolated domain]**: the domain does not depend on frameworks. They are silent on transitive dependencies.

**Options.**
- **A: no, direct imports only (status quo).** *Reason:* the transitive part is already a direction fault, owned by FF-S01 and FF-S04.
- **B: yes.** *Reason:* a domain that reaches a framework through one hop still depends on it at run time.

**Recommendation: A**, because counting it again under purity would make every outward edge also a purity finding (P2).

**Effect on the development set.**
- A: nestjs R 11/11.
- B: nestjs R 11/12 → 12/12.

**Example** (nestjs v10, `domain/registration-policy.ts`):
```ts
import { InMemoryRegistrationRepository } from '../registrations/in-memory-registration.repository';
private readonly history = new InMemoryRegistrationRepository();
```

[Answer]:

---

## Q21. FF-DT05 domain-event placement: advisory or blocking?

**Why it matters.** This affects the agreed row on ddd v05 (DDD notes, proposed ADR 2).

**Literature.** `style-rule-sources.md` has no DDD row for event placement. The sealed tier table calls it a placement guideline. The DDD notes cite Vernon ch. 8 (events are domain objects), which is outside the table.

**Options.**
- **A: advisory, as sealed (status quo).** *Reason:* the table lists no defining-constraint source for event placement.
- **B: blocking.** *Reason:* Vernon makes events domain objects, so an event outside the domain breaks domain modelling.

**Recommendation: A**, because no source in the table states event placement as a constraint, and the sealed row calls it a guideline.

**Effect on the development set.**
- A: ddd R 8/8.
- B: ddd R 9/9.

**Example** (ddd v05):
```ts
// src/billing/application/InvoiceIssued.ts
export class InvoiceIssued implements DomainEvent {
```

[Answer]:

---

## Q22. Does FF-P02 count sibling-service injection (RDQ-3)?

**Why it matters.** Sheet row 14 is nestjs n03, the last near-miss false positive: it has a 0.75 ratio of injected interfaces. FF-P02 is advisory, so this has no blocking effect.

**Literature.** No row covers FF-P02. Martin's DIP (ch. 11) is **not** scoped to boundaries: it says source-code dependencies should refer to abstractions, not concretions, in general. **[SRS: Clean, FF-P03]** applies it *across a boundary*. **[SRS: NestJS]** (Providers) shows injecting a service of the same layer as standard practice.

**Options.**
- **A: yes, count all constructor dependencies (status quo).** *Reason:* this is DIP as Martin states it, with no boundary scope.
- **B: no. Count only dependencies on another layer.** *Reason:* a same-layer service is neither policy nor detail to its sibling, and the framework's documented practice injects it directly.

**Recommendation: B**, stated honestly as a **narrowing** of Martin's DIP to its cross-boundary use. The thesis should say that FF-P02 measures DIP across layers only, not DIP in Martin's general sense.

**Effect on the development set.**
- A: nestjs all-rule P 14/14.
- B: nestjs all-rule P 13/14 → 13/13.

**Example** (nestjs n03, `registrations/registrations.service.ts`):
```ts
import { WorkshopsService } from '../workshops/workshops.service';
    private readonly workshopsService: WorkshopsService,
```

[Answer]:

---

## Q23. FF-P05: is an "entity" selected by its layer or by a name suffix?

**Why it matters.** Sheet rows 2 and 20, clean v07 and nestjs v09, are expected by both manifests. The tool misses them because `Loan` and `Workshop` have no `Entity` suffix (TDC-1). The rule is advisory.

**Literature.** No row covers FF-P05; the tier table calls it a guideline. The declarations define entities by folder (`domain/entities/**`, `src/domain/**`).

**Options.**
- **A: by name suffix (status quo).** *Reason:* the suffix is an explicit marker in the code, and it needs no declaration to be read.
- **B: by the declared domain layer (entity role or folder).** *Reason:* the declaration is the architect's statement, and a suffix is only a naming habit.

**Recommendation: B**, because the declarations define what an entity is, and the tool should read the declaration.

**Effect on the development set.**
- A: no change.
- B: clean all-rule R 15/16 → 16/16; nestjs 12/13 → 13/13.

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

**Literature.** **[SRS: Clean, FF-S01]** constrains direction only. `rule-tiers.md` gives the FF-S03 reason: Clean and Hexagonal allow skipping inward. **[SRS: Hexagonal, port-adapter]** says actors talk through ports. Using a domain value type is not talking to the application.

**Options.**
- **A: no (status quo).** It is not FF-S03 or FF-P04. The controller-to-entity case belongs to FF-P05 (Q23). An exposed lower-layer type is out of scope. *Reason:* the styles permit inward dependencies.
- **B: yes, as an advisory FF-S03 finding when an adapter or controller does work that belongs to a use case.** *Reason:* business work done in an adapter bypasses the use case, which the port-adapter pattern is meant to route through.

**Recommendation: A**, because the styles permit inward dependencies, and the sealed FF-S03 reason says inward skipping is allowed outside layered.

**Effect on the development set.**
- A: no blocking effect; pooled all-rule R 66/67.
- B: hex all-rule R 17/18 → 18/18; clean 16/17 → 17/17.

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
- **A: leave as is (status quo).** *Reason:* no row moves today, and every preset change adds a chance of new behaviour before the hold-out.
- **B: declare them in the presets.** *Reason:* the behaviour is then stated, rather than an accident of the globs.
  - A `composition-root` role, exempt from the layer rules (main, test containers, `*.module.ts`).
  - Directory beats file pattern, as the NestJS preset's comment already says.
  - Unassigned files are not checked by layer rules. In DDD, FF-DS01 reports them (Q15).

**Recommendation: B**, because the presets should state what the tool does with these files.

**Caveat.** As with Q16, run B **once** on the development set before the hold-out, with no second tuning loop. Anything surprising goes into an ADR, not into code.

**Example** (nestjs n02, `src/domain/waitlist.repository.ts`):
```ts
/** A port that lives in src/domain/ but uses the *.repository.ts file name the preset maps to infrastructure. */
export interface WaitlistRepository {
```

[Answer]:

---

## After answering

- Record the answers in an ADR, for example ADR-V13-03 "construct decisions". Each tier or rule move needs a construct reason: Q3 (in-layer cycles advisory), Q5 (new rule id, blocking), Q8 and Q14 (the N/A-half policy), Q15 (deferred, with the invariant caveat), Q21 if B is chosen.
- Before sealing: resolve the ADR-V13-02 / NestJS preset contradiction (Q13 action item).
- Implement the changes the answers imply on a new branch, then re-run `ue-score.ts`. Fill the `adjudication` column of `adjudication.csv` from these answers.
- Q16 and Q25: one development-set run each before the hold-out, and no second tuning loop. Surprises go into an ADR, not code.
- Re-score `construct-decisions-impact.csv` with the revision 1 recommendations held fixed, if the figures are to be quoted anywhere.
- The numbers here are not to be quoted as validity. The sealed hold-out set measures validity.

*Method.* The rows were dumped from `results/v1.3-reference/after-fixes/` (`raw/`, the author-manifests, the blind manifests with `alsoMatches` expanded, cycles keyed on their file set), with the same matching as `scripts/v1.3/lib/compare.ts`. The figures were then re-scored offline per option, holding the other questions at their revision 0 recommendations. With every question at its current behaviour, the script reproduces the after-fixes report exactly (author R 56/57, P 56/56; blind R 52/67, P 52/56). Type-only status was read from the blind graph's `typeOnly` flags. In revision 1 the CSV's option letters were changed to the status-quo-first order of this page, and its `recommended` column was updated; no figure was changed. Q5 option D has no rows in the CSV.

---

## Review applied (revision 1)

An adversarial review of revision 0 found the framing biased toward the recommendations. It challenged two recommendations (Q3, Q10), endorsed nine with changes (Q5, Q8, Q13, Q14, Q15, Q16, Q19, Q22, Q25) and endorsed the rest. Its framing fixes, applied throughout:

- The 56/56 "where this lands" claim was removed from the preamble and kept only as a footnote, which says it holds by construction.
- Options now come in a fixed order (A = status quo), and the recommendation follows them on its own line. Every option has a reason of similar length.
- The figures moved after the literature and options.
- "Expect 30 to 45 minutes" was deleted.
- Four non-construct reasons were struck: Q3 "all five planted cycles were written as violations" (circular); Q5 "needs only a tier change, no new code" (convenience); Q8 "nothing in the set suggests a FLOWS_TO row is wrong" (a precision observation); Q15 "the independent reader also saw it".
- New sections: Principles (P1, P2), "Decide these yourself", "Safe defaults", "Default acceptable only with caveats".

Verdict per question, as the review gave it. "Endorse" means the review raised nothing specific beyond the framing fixes. For Q8, Q14 and Q15 the recommendation still changed, because of the review's stated change.

| Q | Verdict | What changed |
|---|---|---|
| 1 | endorse | Framing only; now decided by P1. |
| 2 | endorse | Framing only; listed under "decide yourself". |
| 3 | **challenge** | Recommendation A → C: in-layer file cycle advisory, cross-layer and cross-component cycles blocking (Martin ch. 13–14: ADP is over components). Circular reason struck. |
| 4 | endorse | Framing only; decided by P2. |
| 5 | endorse-with-change | Still blocking (Cockburn 2005), but under a new rule id (or FF-S01), not FF-S03. Convenience reason struck. Options re-lettered. |
| 6 | endorse | Re-lettered (recommendation is now B); P2 tension noted; listed under "decide yourself". |
| 7 | endorse | Framing only. |
| 8 | endorse-with-change | Recommendation A → B: keep the sealed tier, FLOWS_TO half N/A with denominator and "recall unestimated". Precision reason struck. Merged with Q14 into one policy. |
| 9 | endorse | Framing only. |
| 10 | **challenge** | Recommendation "web frameworks only" → C: FF-P01 not applicable to layered (no purity row; source wins), packages via FF-S01 mapping if declared. No layered-specific package list. |
| 11 | endorse | Framing only. |
| 12 | endorse | Re-lettered (recommendation is now B). |
| 13 | endorse-with-change | Re-lettered (now B). Action item added: fix ADR-V13-02's "Clean Architecture layering" claim or the preset comment before sealing. |
| 14 | endorse-with-change | Recommendation "advisory" → A: keep blocking as sealed, accessor half N/A (same policy as Q8); becomes C once member facts land. |
| 15 | endorse-with-change | Recommendation "advisory" → defer (keep the current blocking state, revisit with hold-out evidence); Evans ch. 14 Shared Kernel cited. Non-construct reason struck. |
| 16 | endorse-with-change | Re-lettered (now B). One development-set run before the hold-out, no second tuning loop. |
| 17, 18, 20, 21, 23, 24 | endorse | Framing only (Q23 re-lettered, now B). |
| 19 | endorse-with-change | Labelled "stricter than Evans (transient references allowed in Evans ch. 6)". |
| 22 | endorse-with-change | Re-lettered (now B). The narrowing is stated: Martin's DIP is not boundary-scoped. |
| 25 | endorse-with-change | Re-lettered (now B). One development-set run before the hold-out, no second tuning loop. |

## Source verification notes (2026-10-16)

An independent check of the sources (`Docs/v1.3/rule-source-verification.md`; corrections in `Docs/v1.3/style-rule-sources-errata.md`) affects these questions. Read them before answering.

- **Q2 (type-only imports):** Martin's blog says an inner circle must not *mention* any outer name ("functions, classes, variables"). That supports counting type-only imports.
- **Q3 (in-layer cycles):** cite Martin ch. 12 (components as units of deployment) and ch. 14 (ADP, p. 112), not "ch. 13 and 14". The argument for option C is unchanged.
- **Q5 (adapter→adapter):** Cockburn never says adapters must not talk to each other, and in his own sample the primary FIT adapter calls the secondary adapter factory. Blocking adapter→adapter is therefore an *inference* from the port concept, not a quotation. Weigh this before choosing a blocking option.
- **Q6 (hexagonal core):** the phrase "application core" quoted as the source does not appear in Cockburn's article. The question should rest on "Intent" and "Nature of the Solution", which state no explicit source-dependency rule.
- **Q7 (FF-P03 consumers):** "the sources are silent on consumers" is not accurate. Martin ch. 11 (DIP) also covers code that uses a concrete class. Option A still holds, because FF-P02 owns that edge.
- **Q10 / Q12 (layered):** Fowler calls layering "mostly opaque", and POSA has a relaxed variant. Strict no-skip is the strict variant only.
- **Q11:** the 2015 *DDD Reference* places the domain below the application layer, which supports A.
- **Q14:** Evans 2003 allows a mutable value object as a performance special case. Note it in the thesis.
- **Q18 (DDD ACL importing upstream internals):** Evans says the anticorruption layer "talks to the other system through its *existing interface*" (Reference 2015, p. 34). That argues *against* the sealed exemption that lets an ACL import upstream internals. Reconsider before confirming A.
- **Q19:** Evans explicitly allows transient references to inner members. "Stricter than Evans" is confirmed.
- **Q13:** the NestJS docs constrain DI injection, not file imports, and their TypeORM example injects a repository into a service.

