# v1.3 construct decisions: answer sheet (score-free)

**2026-10-16. For the thesis author. Derived from `construct-decisions.md` revision 1, with the source-verification notes folded into each question and the rule-level facts found while building the construct switches.**

## Instructions (read first)

1. **Answer every question on this sheet before you open `construct-switches.md`, `construct-decisions-impact.csv` or the original `construct-decisions.md`.** Those files print development-set figures and the earlier preferred options beside the options. This sheet has neither, so that each answer rests on the construct and its sources.
2. **The answers are committed as ADR-V13-03 "construct decisions" before any re-score.** Commit this sheet with the answers filled in first; only then run the offline preview or the development-set re-run.
3. **A blank `[Answer]:` keeps the status quo (option A).** Option A is always what the tool does today. Where the sealed text or the tool differs from the option's wording, the question says so.
4. Write one letter on each `[Answer]:` line, and give your reason in one or two sentences, citing sources only. Do not cite results.
5. A tier change still needs a construct reason (`rule-tiers.md`); the "Tier ADR" note on an option says when one is owed.

**What was removed.** Every figure that shows an option's effect on the development set, every count of rows or findings, every reference to which manifest expects which row, and every preferred option with its rationale. **What was kept.** Why each question matters, the source arguments (corrected by `rule-source-verification.md` and `style-rule-sources-errata.md`), what each option means, and what it changes in the rule. Numbers that describe a rule itself (a threshold, a page number) are kept.

**Precedence.** When a style's canonical source and a rule's current wording disagree, the source wins (`Docs/v1.3-reference-notes.md`, "Precedence"). Source rows are cited as **[SRS: Style, Rule]** from `Docs/v1.3/style-rule-sources.md`, read together with its errata. Wording marked *(recalled)* has not been checked in print.

## Index

| Q | Question | A (status quo) | Other options |
|---|---|---|---|
| 1 | FF-P06 in layered | not applicable | B advisory in layered; C blocking in layered (v1.2E) |
| 2 | Type-only imports count? | yes | B no |
| 3 | In-layer file cycle under FF-S02 | blocking | B not counted; C advisory |
| 4 | Layer-level cycle without a file cycle | not FF-S02 | B FF-S02 on the layer graph |
| 5 | Adapter-to-adapter edge | FF-S03, advisory | B FF-S03 blocking (hex, ddd); C FF-S01; D new rule id, blocking |
| 6 | Hexagonal core = domain + application? | domain only | B domain + application |
| 7 | FF-P03 covers consumers of a concrete adapter? | no | B yes |
| 8 | FF-P06 field initialisers | see the question | B sealed text: field half N/A |
| 9 | Missing `implements` | FF-P03 yes, FF-P02 no | B both; C neither |
| 10 | FF-P01 in the layered business layer | every declared framework | B web/UI only; C not applicable, package mapping under FF-S01; D not applicable |
| 11 | Domain-to-application inside the core | forbidden (FF-S01) | B allowed |
| 12 | Upward adjacent import also FF-S03 (layered)? | yes | B no |
| 13 | NestJS layer order and FF-P04 | preset order, FF-P04 as is | B FF-P04 follows the order; C Clean order |
| 14 | FF-DT03 tier | blocking | B advisory; C blocking with member facts |
| 15 | FF-DS01 tier | blocking, deferred | B advisory |
| 16 | FF-S02 in the DDD preset | no | B yes |
| 17 | DDD public API: literal or resolved | literal | B resolved; C literal plus advisory barrel rule |
| 18 | DDD ACL may import upstream internals? | yes (sealed) | B no |
| 19 | Aggregate boundary: any import of an inner entity | yes | B only kept references |
| 20 | Transitive framework dependencies in purity | no | B yes |
| 21 | FF-DT05 tier | advisory | B blocking |
| 22 | FF-P02 counts sibling-service injection? | yes | B no |
| 23 | FF-P05 entity selection | name suffix | B declared domain layer |
| 24 | Inward bypass of the use-case layer | not a finding | B advisory FF-S03 |
| 25 | Files outside the layer model | as is | B declared roles in the presets |

---

## Principles

Two principles bear on several questions. Decide them first, then apply your answer consistently in the questions they bear on.

**P1. Silent sources mean not applicable.** When the canonical sources are silent for a style, the rule is not applicable in that style. It is not kept by default, and no style-specific substitute is invented. *Bears on:* Q1, Q10, Q16. For Q16, note that ADP (Martin 2017, ch. 14) is stated for components in general, not for a style, so whether the "sources are silent" for DDD depends on whether a style-independent principle counts as a source for every style.

[Answer]: 

Reason (one or two sentences, sources only, no scores):

**P2. One edge, one rule.** An edge is reported under the rule whose construct it breaks, and not again under a second rule. *Bears on:* Q4, Q5, Q6, Q7, Q11, Q12, Q20. The existing domain-to-adapter overlap of FF-S01 and FF-S04 already reports one edge under two rules.

[Answer]: 

Reason (one or two sentences, sources only, no scores):

---

## Q1. FF-P06 in layered: confirm it is not applicable (ADR-V13-02)?

**Why it matters.** ADR-V13-02 made FF-P06 (domain-state purity) not applicable to `layered`. Sealed v1.2E behaviour applied it there as blocking. The question is whether to keep the change. In layered, business services routinely hold gateways to the data-source layer, so the rule's applicability decides whether that dependency is a finding at all.

**Sources.** **[SRS: Layered, FF-S01/S03]** (Fowler 2002, ch. 1; POSA 1, ch. 2 §2.2 "Layers"): a higher layer uses the layer below. Fowler's bliki entry "PresentationDomainDataLayering" (2015) says "presentation depends on the domain, which then depends on the data source", and Active Record puts persistence in domain objects. Evans 2003 ch. 4 also keeps infrastructure below the domain. The sources table has no isolated-domain row for Layered: that constraint comes only from **[SRS: Clean, FF-P01]**, **[SRS: Hexagonal, core isolation]** and **[SRS: DDD, isolated domain]**. FF-P06 has no source row of its own (errata, "Missing rows").

**Options.**
- **A: confirm (status quo).** FF-P06 is not applicable to `layered`; its tier is unchanged elsewhere.
  - *Meaning:* in closed layering, a business service that holds a gateway is the intended dependency, so there is nothing to report.
  - *Rule change:* none; ADR-V13-02 is signed as written.
- **B: keep FF-P06 in layered, as advisory.**
  - *Meaning:* a reader may still want to see where business code holds persistence state, as advice rather than as a verdict.
  - *Rule change:* FF-P06 is compiled for layered again, with an advisory tier there. Tier ADR owed.
- **C: revert to v1.2E (blocking in layered).**
  - *Meaning:* one rule set across styles, matching the registered v1.2E rule set.
  - *Rule change:* FF-P06 is compiled for layered as blocking. Applicability ADR owed.

**Example** (layered clean variant):
```ts
export class OrderService {
  constructor(private readonly orders: OrderGateway, private readonly products: ProductGateway) {}
```

[Answer]: 

Reason (one or two sentences, sources only, no scores):

---

## Q2. Does a type-only import (`import type`) count as a dependency?

**Why it matters.** Every edge rule (FF-S01, FF-S04, FF-P01, FF-DS02, FF-DT01) and every cycle reads import edges, so this decides the unit of "dependency" for the whole rule set. DDD code in particular uses `import type` across layers and contexts. This is ambiguity 4 in the blind summary.

**Sources.** The sources are silent on TypeScript type imports as such. **[SRS: Clean, FF-S01]** speaks of *source-code* dependencies, and an `import type` is one: the file does not compile without the other file. Martin's blog (2012, "The Dependency Rule") is more direct: "the name of something declared in an outer circle must not be mentioned by the code in an inner circle. That includes functions, classes, variables, or any other named software entity." An `import type` mentions a name.

**Options.**
- **A: yes, count them (status quo).**
  - *Meaning:* the constraint is about what a module knows, not about what survives compilation. A domain entity that types its parameter as `express.Request` knows the web layer.
  - *Rule change:* none.
- **B: no. Ignore edges whose every import is `import type`.**
  - *Meaning:* a type-only edge leaves no runtime dependency, so it cannot cause load-order or deployment coupling.
  - *Rule change:* edge rules and cycle detection drop edges whose every specifier is type-only, and a cycle closed by a type-only edge is not reported. The coupling metrics (advisory) still count type-only edges unless changed separately. Rule ADR owed.

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

Reason (one or two sentences, sources only, no scores):

---

## Q3. Does a file cycle inside one layer violate ADP (FF-S02)?

**Why it matters.** This decides the unit of FF-S02: whether cycles between two files of the same layer (clean v03, layered v05 and v06, hex v11) are treated like cycles that cross a layer or a feature module (nestjs v04) or cross application and domain (the ddd v09 cycle of Q16). This is ambiguity 1.

**Sources.** **[SRS: Clean/Layered, FF-S02]**: "Allow no cycles in the component dependency graph" (Martin 2017, ch. 14 "Component Coupling", p. 112). Martin defines a component in **ch. 12** as a unit of deployment (a jar, a DLL) *(recalled)*; ch. 13 is Component Cohesion and is not the ADP source (errata). A TypeScript file is not a component in Martin's sense, so a file-level cycle inside one layer is a proxy for ADP, and `rule-tiers.md` makes a proxy advisory. Martin presents ADP in Part IV, apart from any style.

**Options.**
- **A: yes, blocking (status quo).** The unit of FF-S02 is the file (ES module).
  - *Meaning:* in TypeScript the file is what is imported and loaded, and cycles between files cause the load-order faults ADP guards against.
  - *Rule change:* none.
- **B: no. Only cycles that cross a layer or module boundary count.**
  - *Meaning:* Martin states ADP over components, and a layer or a feature module is the nearest declared component; an in-layer cycle is outside the rule.
  - *Rule change:* cycles whose files all lie in one layer and one module (NestJS feature folder, DDD context) are dropped. Rule ADR owed.
- **C: both count, but an in-layer cycle is advisory.** Cross-layer and cross-component cycles stay blocking.
  - *Meaning:* the in-layer file cycle is a proxy for ADP, so it is reported as advice; a cycle across declared components is the construct itself.
  - *Rule change:* FF-S02 gets a second, advisory row class for in-layer cycles. Tier ADR owed. The thesis states the unit.

**Example** (clean v03):
```ts
// src/domain/entities/Loan.ts
import { Member } from './Member';
// src/domain/entities/Member.ts
import { Loan } from './Loan';
```

[Answer]: 

Reason (one or two sentences, sources only, no scores):

---

## Q4. Is a layer-level cycle without a file cycle an FF-S02 violation?

**Why it matters.** When one upward edge exists between two layers that also have the normal downward edges, the layer graph has a cycle even though no file cycle exists (clean v01 and v09, layered v01 and v02). FF-S01 already reports the upward edge.

**Sources.** **[SRS: Clean/Layered, FF-S02]** is about the component graph. **[SRS: Layered, FF-S01/S03]** already forbids the upward edge. Martin does not treat a layer as an ADP component; in ch. 14 the remedy for a cycle is DIP or a new component, which concerns release units, not layers.

**Options.**
- **A: no (status quo).**
  - *Meaning:* the downward edges always exist, so every upward edge closes a layer cycle; FF-S02 on layers would be FF-S01 counted twice.
  - *Rule change:* none.
- **B: yes. Also compute cycles on the layer graph.**
  - *Meaning:* a layer is a declared grouping, and a cycle on the layer graph is the shape ADP names at that grain.
  - *Rule change:* FF-S02 reports every edge against the allowed direction between two layers that also depend on each other, outside any file cycle. Rule ADR owed.
  - **Scope note (switch build):** B is wider than the question first implied. It is not limited to clean and layered: it applies in every style whose spec declares a layer order, including nestjs and hexagonal, and it fires on every edge that closes a layer cycle in every variant, not only on the variants named above.

**Example** (clean v01):
```ts
// src/domain/entities/Loan.ts: domain imports an application port
import { Clock } from '../../application/ports/Clock';
```

[Answer]: 

Reason (one or two sentences, sources only, no scores):

---

## Q5. Adapter-to-adapter: a direction violation or a layer skip, and does it block?

**Why it matters.** An inbound adapter that imports an outbound adapter (hex v05, v06) is today reported by the hexagonal `layer-skip-graph` template under FF-S03, which is advisory outside layered. This is the DDD notes' proposed ADR 3. In ddd, the same choice decides the tier of an `api`-to-`infrastructure` edge (ddd v10).

**Sources.** **[SRS: Hexagonal, port-adapter]** and **[SRS: Hexagonal, core isolation]** (Cockburn 2005, "Intent", "Nature of the Solution"): the application "communicates over ports to external agencies", and each adapter converts between a port and a device. **Correction from the source check:** Cockburn never writes that adapters must not talk to each other, and in his own sample ("Sample Code", Stage 3) the primary FIT adapter `TestDiscounter` constructs the application with `RepositoryFactory.getMockRateRepository()`, a configuration-time edge from a primary adapter to the secondary side. Adapter isolation is therefore an **inference from the port concept, not a quotation**. A blocking reading should either exempt wiring or composition code (Cockburn's later "configurator" idea) or be labelled stricter than Cockburn's 2005 sample. The sealed FF-S03 reason ("hexagonal does not define strict layering") is about skipping a ring, which is not the edge in question; carrying a blocking adapter constraint under the FF-S03 id would give one id two constructs with opposite tier logic.

**Options.**
- **A: keep FF-S03 `layer-skip-graph`, advisory (status quo, as sealed).**
  - *Meaning:* the sealed row tiers this template advisory, and changing it is a construct change made after seeing the data.
  - *Rule change:* none.
- **B: keep FF-S03, made blocking in hexagonal and ddd.**
  - *Meaning:* the template already reports an edge between two layers with no allowed edge in either direction, which is read as the adapter constraint.
  - *Rule change:* tier override for FF-S03 in hexagonal and ddd. Tier ADR owed. FF-S03 then carries two tier logics.
- **C: report it under FF-S01, blocking.**
  - *Meaning:* FF-S01 is the blocking dependency rule, and an edge to a layer with no allowed edge is a forbidden dependency.
  - *Rule change:* adapter-to-adapter edges move from FF-S03 to FF-S01. Rule ADR owed.
- **D: report it under a new rule id (an `adapter-isolation` rule, FF-S05, in the hexagonal library), blocking in hexagonal and ddd.**
  - *Meaning:* the edge breaks a constraint of its own (adapters talk only through ports), so it gets its own id and tier row, and FF-S03 keeps one meaning.
  - *Rule change:* a new rule and a new tier row. Rule ADR and tier ADR owed.

Under C or D, FF-S03 no longer reports the edge (P2). Under B, C or D, decide whether composition code is exempt (see Sources).

**Example** (hex v05, `adapters/inbound/http/RoomController.ts`):
```ts
import { InMemoryRoomRepository } from '../../outbound/persistence/InMemoryRoomRepository';
constructor(private readonly findAvailableRooms: FindAvailableRooms,
            private readonly roomStore: InMemoryRoomRepository) {}
```

[Answer]: 

Reason (one or two sentences, sources only, no scores):

---

## Q6. Does hexagonal core isolation (FF-S04) cover the application layer?

**Why it matters.** The hexagonal declaration splits `domain` from `application`, and the FF-S04 template binds only `domain`. Application services that import an adapter (hex v03, v04) are therefore outside FF-S04 today. Under B, an edge from domain to an application port (hex v02) becomes an edge inside the core, so FF-S04 no longer reports it; FF-S01 still does (Q11).

**Sources.** **[SRS: Hexagonal, core isolation]** (Cockburn 2005). **Correction from the source check:** the phrase "application core" is not Cockburn's wording; the article never uses "core". He speaks of "the application", "the inside" and "the inner hexagon", and his one explicit rule is about logic: "code pertaining to the inside part should not leak into the outside part" ("Nature of the Solution"). He states no source-dependency rule, and he does not split the hexagon into domain and application. Rest the question on "Intent" and "Nature of the Solution": the hexagon is the whole application.

**Options.**
- **A: no. The core is the domain only (status quo).**
  - *Meaning:* the declaration splits domain from application, and the template binds the layer the other styles call the isolated domain.
  - *Rule change:* none.
- **B: yes. In hexagonal, the core is domain plus application.**
  - *Meaning:* Cockburn's hexagon contains the application, so an application service that imports an adapter breaks core isolation.
  - *Rule change:* FF-S04 in hexagonal binds domain and application; application-to-outside edges are added and domain-to-application edges leave FF-S04. Rule ADR owed. P2 tension: under B an application-to-adapter edge is reported by both FF-S01 and FF-S04, as domain-to-adapter edges already are. If P2 is confirmed, say which rule owns that edge.

**Example** (hex v04, `application/services/CancelBookingService.ts`):
```ts
import { HttpError } from '../../adapters/inbound/http/HttpTypes';
if (booking === undefined) throw new HttpError(404, `No booking ${bookingId}`);
```

[Answer]: 

Reason (one or two sentences, sources only, no scores):

---

## Q7. Does FF-P03 / port-adapter-pattern cover a *consumer* of a concrete adapter?

**Why it matters.** Something that injects or imports a concrete adapter (nestjs v07, hex v03 and v05) is already reported by FF-S01 and FF-P02. The question is whether the placement rule also reports it.

**Sources.** **[SRS: Clean, FF-P03]** gives the port's place (inner layer) and the implementation's place (outer layer); the gateway-placement text is Martin 2017 ch. 23 "Database Gateways" (p. 214), with ch. 17's boundary figure (errata). **[SRS: Hexagonal, port-adapter]**: adapters implement ports. These placement texts describe the *implementer*. **Correction from the source check:** "the sources are silent on consumers" is not accurate. Martin ch. 11 (DIP) addresses the user of a class: "Don't refer to volatile concrete classes. Refer to abstract interfaces instead" *(recalled)*. So a consumer that names a concrete adapter breaks DIP; the question is which rule owns that. Caveat: the blind package had no `ports/out/` folder, so its hexagonal FF-P03 readings were made without the ports.

**Options.**
- **A: no (status quo).** FF-P03 is about where the port and its implementation live.
  - *Meaning:* the consumer's fault is a direction fault (FF-S01, FF-S04) or a DIP fault (FF-P02, the rule that owns ch. 11), and those rules already report it.
  - *Rule change:* none.
- **B: yes. Any dependency on a concrete adapter also breaks FF-P03.**
  - *Meaning:* a consumer that names the concrete adapter defeats the port, so the pattern is broken at its use site.
  - *Rule change:* FF-P03 reports every file outside the adapter layer and the composition roots that imports or injects a concrete adapter. Rule ADR owed.

**Example** (hex v03, `application/services/FindAvailableRoomsService.ts`):
```ts
import { InMemoryRoomRepository } from '../../adapters/outbound/persistence/InMemoryRoomRepository';
    private readonly rooms: InMemoryRoomRepository,
```

[Answer]: 

Reason (one or two sentences, sources only, no scores):

---

## Policy for Q8 and Q14: a sealed tier that assumes a fact the extractor lacks

Q8 and Q14 are one question asked twice. In each, the sealed tier assumes a fact the extractor does not record, or records only sparsely: `FLOWS_TO` for FF-P06, member modifiers and accessors for FF-DT03. Answer them with one policy, and apply the same policy to both.

- **Policy (i): keep the sealed tier.** Report the uncovered half as **N/A**, with its denominator (the cases where the missing fact would be needed) and the label "coverage not estimated". Do not use agreement on a handful of cases to re-validate the uncovered half: `rule-tiers.md` does not accept observed agreement as a reason to move a tier.
- **Policy (ii): amend the sealed tier note by ADR.** Treat the sparse fact as sufficient and remove the N/A half, or move the rule to advisory until the fact is recorded.

[Answer] (i or ii): 

Reason (one or two sentences, sources only, no scores):

## Q8. FF-P06: does a field initialiser (`= new Impl()`) count?

**Why it matters.** FF-P06 has two halves: constructor injection, and a field initialiser seen through `FLOWS_TO`. The sealed tier row calls the `FLOWS_TO` half "near-empty… reported N/A" and says "only the constructor-injection half is valid". This is ambiguity 11.

**Sources.** No source row covers FF-P06 (errata, "Missing rows"). Its construct, "core isolation of state" (`rule-tiers.md`), rests on **[SRS: Clean, FF-P01]** and **[SRS: Hexagonal, core isolation]**. A domain class that builds and keeps an infrastructure object holds infrastructure state, whether it gets the object from a constructor parameter or a field.

**What the tool does today (switch build).** Option A as originally worded is not the current tool. The pipeline's v1.3 verdict **already treats the field-initialiser half of FF-P06 as N/A** (`RULE_TIERS` FF-P06 `partial`, `tiered-scoring.ts`); only the reference comparison script treats those findings as blocking. A blank answer keeps both readings exactly as they are.

**Options.**
- **A: yes, the field-initialiser half blocks.** The "partial" note is amended by ADR.
  - *Meaning:* the construct does not depend on how the object arrives, so a field initialiser is the same breach as constructor injection.
  - *Rule change:* choosing A means **reversing, by decision record, the N/A treatment the pipeline already applies**: the `partial` entry is removed and the field half becomes blocking in the verdict as well. Tier ADR owed (amend the "partial" note). This reversal is not pre-built as a switch.
- **B: follow the sealed text.** The constructor-injection half is blocking; the `FLOWS_TO` half is reported N/A with its denominator and "coverage not estimated", and its findings are listed there.
  - *Meaning:* the sealed row says the half is near-empty, so its coverage is unknown and it cannot support a blocking verdict.
  - *Rule change:* none in the pipeline; the reference comparison is brought in line with the sealed text. Policy entry in ADR-V13-03.

**Example** (clean v08, `domain/services/LoanPolicy.ts`):
```ts
import { SystemClock } from '../../infrastructure/system/SystemClock';
export class LoanPolicy {
  private readonly clock = new SystemClock();
```

[Answer]: 

Reason (one or two sentences, sources only, no scores):

---

## Q9. Missing `implements` under structural typing: FF-P03? FF-P02?

**Why it matters.** Three variants drop an `implements` clause while the class is still wired where the port is expected (clean v06, nestjs v08, hex v08). hex v09 is different: the adapter implements an interface it owns. This is ambiguity 2.

**Sources.** **[SRS: Clean, FF-P03]** (Martin ch. 11, 22 and 23): dependency inversion across the boundary; the implementation depends on, and points at, the inner interface. **[SRS: Hexagonal, port-adapter]**: in Cockburn's sample, `MockRateRepository implements RateRepository`. Martin's DIP is stated for languages with explicit interfaces; the sources say nothing about structural typing, so a missing `implements` has no source ruling.

**Options.**
- **A: FF-P03 yes, FF-P02 no (status quo).**
  - *Meaning:* without `implements` the source has no dependency from the implementation to the port, so the inversion is not stated. FF-P02 measures the consumer's injected types, which have not changed.
  - *Rule change:* none.
- **B: FF-P03 and FF-P02 both.**
  - *Meaning:* the missing clause weakens the inversion on both sides, so both the implementer rule and the inversion rule report it.
  - *Rule change:* each FF-P03 finding also produces an FF-P02 finding on the implementer. FF-P02 is advisory. Rule ADR owed.
- **C: neither. Conformance plus wiring is enough.**
  - *Meaning:* under structural typing the class satisfies the port, and the wiring shows it is used as one.
  - *Rule change:* FF-P03 is not reported for a class with no `implements` whose methods cover a port's methods and that is imported somewhere. Rule ADR owed.

**Example** (clean v06):
```ts
// was: export class InMemoryLoanRepository implements LoanRepository {
export class InMemoryLoanRepository {
```

[Answer]: 

Reason (one or two sentences, sources only, no scores):

---

## Q10. Does FF-P01 domain purity apply to the business layer in layered?

**Why it matters.** The layered preset declares the business layer as the domain kind, so FF-P01 forbids every declared framework there, both a persistence decorator (layered v07, `typeorm`) and a web type (layered v08, `express`). This is ambiguity 5.

**Sources.** **[SRS: Layered]** states no purity rule: the sources table has no purity row for Layered. Martin's purity rule belongs to Clean, and nothing in Martin carries it over to Layered. Fowler's layering puts the domain *above* the data source ("presentation depends on the domain, which then depends on the data source", bliki 2015), and Active Record "wraps a row in a database table … and adds domain logic on that data" (PoEAA catalogue). Evans 2003 ch. 4 also keeps infrastructure below the domain. The upward reach to the web layer is covered by the direction clause: PoEAA ch. 1 says the domain and data source "should never be dependent on the presentation" *(recalled)*, and **[SRS: Layered, FF-S01/S03]** says lower layers do not use upper ones. Fowler also calls most layering "mostly opaque" *(recalled)*. By the precedence rule, the source wins over the rule's current wording, as in Q1.

**Options.**
- **A: FF-P01 forbids every declared framework in the business layer (status quo).**
  - *Meaning:* the preset declares the business layer as the domain kind, and FF-P01 is blocking wherever a domain kind is declared.
  - *Rule change:* none.
- **B: FF-P01 forbids web/UI framework packages only** (`express`, not `typeorm`).
  - *Meaning:* it reports the upward reach the style forbids without forbidding the persistence coupling the style allows.
  - *Rule change:* a layered-specific list of web/UI packages that no source states. Rule ADR owed.
- **C: FF-P01 is not applicable to layered. Packages are handled by FF-S01 through a package-to-layer mapping, where the spec declares one.**
  - *Meaning:* the source has no purity rule for layered, and the upward reach it does forbid is a direction fact, which belongs to FF-S01.
  - *Rule change:* FF-P01 is not compiled for layered; a new mechanism maps packages (for example `express`) to a layer so FF-S01 can report the upward reach. Without a declared mapping, C behaves as D. Applicability and rule ADRs owed.
- **D: FF-P01 is not applicable, and there is no replacement.**
  - *Meaning:* the source has no purity rule for layered, and a package import is outside what the layered rules check.
  - *Rule change:* FF-P01 is not compiled for layered. Applicability ADR owed.

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

Reason (one or two sentences, sources only, no scores):

---

## Q11. Is domain-to-application forbidden inside the core (hexagonal, DDD)?

**Why it matters.** Both the hexagonal and the DDD declarations split domain from application. This decides whether an edge from a domain file to an application file (hex v02, ddd v09) is a direction violation, and it interacts with Q6. This is ambiguity 10.

**Sources.** **[SRS: DDD, isolated domain]**: the 2015 *DDD Reference* (p. 10) says to "eliminate any dependency on infrastructure, user interface, or even application logic that is not business logic", and each layer "depends only on the layers below". Both Evans editions put the domain below the application layer. **[SRS: Clean, FF-S01]**: entities do not know use cases. **[SRS: Hexagonal]** is silent: Cockburn does not split the inside of the hexagon.

**Options.**
- **A: forbidden, by FF-S01, wherever the declaration splits domain from application (status quo).** FF-S04 stays out of DDD.
  - *Meaning:* both declarations make the split, and Evans and Martin put the domain below the application.
  - *Rule change:* none.
- **B: allowed. The core is one unit.**
  - *Meaning:* Cockburn does not split the hexagon, so an edge inside it is not a boundary crossing.
  - *Rule change:* FF-S01 and FF-S04 no longer report a domain-to-application edge in hexagonal and ddd. Rule ADR owed.

**Example** (ddd v09, `ordering/domain/customer/Customer.ts`):
```ts
import type { PlaceOrderCommand } from '../../application/PlaceOrder.js';
```

[Answer]: 

Reason (one or two sentences, sources only, no scores):

---

## Q12. In layered, is an upward adjacent import *also* an FF-S03 layer skip?

**Why it matters.** The `no-layer-skip` template fires on every edge that is not in the allowed set, including upward ones, so an upward import between adjacent layers (layered v01, v02) is reported under both FF-S01 and FF-S03.

**Sources.** **[SRS: Layered, FF-S01/S03]**: lower layers do not use upper ones, and strict layering also forbids skipping a layer. A skip passes over an intermediate layer; an upward use passes over none. **From the source check:** POSA states the strict rule as one sentence (the services of Layer J are used only by Layer J+1), POSA also names a "Relaxed Layered System" variant, and it routes notifications upward through callbacks. So strict no-skip is the strict variant only, and splitting POSA's one sentence into two clauses (FF-S01 and FF-S03) is a modelling choice; state it as such.

**Options.**
- **A: yes. Report both rules (status quo).**
  - *Meaning:* the edge is not in the allowed set, and strict layering allows only adjacent downward edges, which this edge is not.
  - *Rule change:* none.
- **B: no. FF-S03 reports only downward edges that pass over a layer.**
  - *Meaning:* the two clauses are separate constraints, and an upward edge has nothing to skip.
  - *Rule change:* the layered FF-S03 template drops edges whose reverse transition is allowed. Rule ADR owed.

**Example** (layered v01, `persistence/ProductGateway.ts`):
```ts
import { Money } from '../business/model/Money';
priceOf(sku: string): Money | undefined {
```

[Answer]: 

Reason (one or two sentences, sources only, no scores):

---

## Q13. NestJS: may an application service import a repository class (layer order; RDQ-2)?

**Why it matters.** The NestJS preset's layer order decides whether a service that imports a concrete repository (nestjs v07) breaks FF-S01, whether a repository that imports a DTO (nestjs v02) does, and how FF-P04 (use-case isolation, advisory) reads the order. This is ambiguity 6b.

**Sources.** **[SRS: NestJS]** ("Modules", "Providers") is silent on layer order. **From the source check:** the NestJS module guarantee constrains **DI injection**, not TypeScript file imports; "Providers" says controllers "delegate more complex tasks to providers", and "services, repositories, factories, and helpers, can be treated as providers"; and the docs' own TypeORM recipe ("Repository pattern") injects the `User` repository into `UsersService` with `@InjectRepository()`. `presets/nestjs.yaml` is explicit: its comment gives the order Controller, then Service, then Repository, and says "NestJS treats infrastructure as an inner data-access layer that application services call directly." ADR-V13-02 says the opposite: it calls the NestJS preset "a Clean Architecture layering inside Nest modules". The docs support the preset's reading, not ADR-V13-02's wording.

**Options.**
- **A: keep the preset's order, and leave FF-P04 as it is (status quo).**
  - *Meaning:* the preset states the order, and FF-P04 is advisory, so its mismatch with the order costs no verdict.
  - *Rule change:* none.
- **B: keep the preset's order, and make FF-P04 follow it.** v07's defect is then DIP only (FF-P02, advisory).
  - *Meaning:* the preset states the order, the NestJS docs' standard flow agrees, and an advisory rule should not contradict the declared order.
  - *Rule change:* FF-P04 no longer reports a use case whose violating dependencies all lie below it in the declared order. Rule ADR owed.
- **C: Clean order, with infrastructure outermost** (domain, application, presentation, infrastructure). v07 becomes an FF-S01 violation, and v02 is no longer one.
  - *Meaning:* ADR-V13-02 treats the NestJS preset as Clean layering, and under Clean the service must not know the repository class.
  - *Rule change:* preset change. **Coherence note (switch build): C is only coherent together with Q25 B.** On its own, the Clean order makes every NestJS `*.module.ts` file that wires a repository implementation an FF-S01 violation, because module files are bound to a layer and import the repository class to register it. With Q25 B, module files are a composition-root role exempt from the layer rules, and C has the effect its wording describes. If you choose C here, answer B in Q25.

**Action item (before sealing, whichever option is chosen).** Fix the contradiction: correct ADR-V13-02's claim that the NestJS preset is "a Clean Architecture layering" (under A or B), or correct the preset comment (under C). ADR-V13-02 uses that claim to apply the Clean reasoning for FF-P06 to NestJS, so check that its FF-P06 conclusion still holds once the claim is fixed.

**Example** (nestjs v07, `registrations/registrations.service.ts`):
```ts
import { InMemoryRegistrationRepository } from './in-memory-registration.repository';
    private readonly registrations: InMemoryRegistrationRepository,
```

[Answer]: 

Reason (one or two sentences, sources only, no scores):

---

## Q14. FF-DT03 value-object immutability: blocking or advisory?

**Why it matters.** The sealed row checks immutability "as a declaration fact (readonly, no setters)". The extractor first recorded only setter-named methods, so a `set value` accessor (ddd g01) was invisible. This is the DDD notes' proposed ADR 1, and it falls under the policy for Q8 and Q14 above.

**Sources.** **[SRS: DDD, value-object immutability]**: "Treat the value object as immutable. Make all operations Side-effect-free Functions that don't depend on any mutable state" (*DDD Reference* 2015, p. 12), stated without exception. "Replace it rather than modify it" is Vernon's Replaceability (IDDD ch. 6) *(recalled)*. **From the source check:** Evans 2003 ch. 5 allows a mutable value object as a special case for performance, when the value is not shared *(recalled)*. So immutability is the default in Evans 2003, not an absolute; cite p. 12 for a blocking reading and note the 2003 exception in the thesis as a validity threat. The DDD notes proposed the advisory move before the rule was run.

**What the tool does today (switch build).** Member facts (`readonly`, accessors) were merged into the extractor (#90), so g01's set accessor is now recorded. Option A's "accessor half N/A" no longer describes the tool: A and C now behave the same.

**Options.**
- **A: blocking, as sealed (status quo).** Any half the extractor cannot see is reported N/A with its denominator.
  - *Meaning:* the construct is defining, so the sealed tier stands, and any missing fact is reported as a known gap.
  - *Rule change:* none.
- **B: advisory until the extractor records member modifiers.**
  - *Meaning:* a blocking rule must be checked as a precise fact, and part of the fact was not recorded.
  - *Rule change:* tier override to advisory. Tier ADR owed.
- **C: blocking, with member facts added to the extractor.**
  - *Meaning:* the construct is defining, and with the facts recorded the rule checks it in full.
  - *Rule change:* none beyond the merged member facts; a note that the N/A half is now covered.

**Example** (ddd g01, `ordering/domain/value-objects/Quantity.ts`):
```ts
private current: number;
set value(v: number) { this.current = v; }
```

[Answer]: 

Reason (one or two sentences, sources only, no scores):

---

## Q15. FF-DS01 bounded-context-modules: blocking or advisory?

**Why it matters.** FF-DS01 reports code that lies in no bounded context, such as a shared helper folder (ddd v07, `src/utils/formatCurrency.ts`). FF-DS01 has no row in the sealed `rule-tiers.md`; the tool tiers it blocking from the DDD library notes (`Docs/v1.3-ddd-notes.md` §2, written before validation).

**Sources.** **[SRS: DDD, bounded-context isolation]**: "Explicitly define the context within which a model applies" (*DDD Reference* 2015, p. 2). Shared Kernel: "Designate with an explicit boundary some subset of the domain model that the teams agree to share" (p. 31). So a helper that lies in no context and is not declared a shared kernel is undesignated shared code. Whether that is a defining breach or a placement guideline is not settled by the sources. FF-DS01 has no source row (errata, "Missing rows"): if it stays blocking, it needs one before the freeze.

**Options.**
- **A: keep it blocking (status quo), and defer the tier decision** to a construct decision with hold-out evidence.
  - *Meaning:* Evans requires shared code to be designated, so the current tier has a construct reading, and one case is too little to settle it.
  - *Rule change:* none now. Caveat: under A a rule with no sealed row can fail a verdict, so the invariant "only rules the sealed table names blocking can fail a verdict" does not hold literally. State that in the ADR, or report FF-DS01 findings separately in the hold-out until the decision is made.
- **B: advisory, with its own row in the tier table by ADR.**
  - *Meaning:* a stray helper folder breaks no model boundary, and FF-DS02 still blocks any cross-context import.
  - *Rule change:* tier row added, advisory. Tier ADR owed.

**Example** (ddd v07, `billing/api/InvoiceController.ts`):
```ts
import { formatCurrency } from '../../utils/formatCurrency.js';
```

[Answer]: 

Reason (one or two sentences, sources only, no scores):

---

## Q16. Should the DDD preset include FF-S02 (cycles)?

**Why it matters.** The DDD preset has no cycle rule, so a three-file cycle that crosses application and domain (ddd v09, `PlaceOrder`, `CustomerRepository`, `Customer`, back to `PlaceOrder`) is not reported by any DDD rule.

**Sources.** **[SRS: Clean/Layered, FF-S02]** lists ADP for Clean and Layered only, and the DDD rows are silent on cycles. **From the source check:** Martin states ADP in Part IV, "Component Principles", for components of any system, not for a style; the "Clean, Layered" label on the row is the thesis's choice. If B is chosen, state which units count as components in DDD (layers, contexts or both); with Q3 C, the v09 cycle is a component-level cycle only if DDD's layers or contexts are taken as the components.

**Options.**
- **A: no (status quo).**
  - *Meaning:* the DDD sources state no acyclicity constraint, so the DDD rule set does not include one.
  - *Rule change:* none.
- **B: yes, add FF-S02 (blocking) to the DDD preset.**
  - *Meaning:* ADP is not specific to any style, and the DDD reference uses the same file-level module graph as the others.
  - *Rule change:* preset addition. Procedure: B adds a rule to a preset after the development set was examined, so it gets **one** development-set run before the hold-out, with no second tuning loop; anything surprising goes into an ADR, not into code.

**Example:** see Q11. The `import type` of `PlaceOrderCommand` in `Customer.ts` closes the cycle.

[Answer]: 

Reason (one or two sentences, sources only, no scores):

---

## Q17. DDD public API: the literal specifier or the resolved target?

**Why it matters.** ddd g02 imports `GetOrderSummary` through `ordering/index.ts`; g03 imports the same file directly. Fix 6 adopted the literal reading (an import through the barrel is public). This is ambiguity 7.

**Sources.** **[SRS: DDD, bounded-context isolation]**: integration goes through a published interface. Its nearest Evans pattern is Open-host Service: "Define a protocol that gives access to your subsystem as a set of services" (*DDD Reference* 2015, p. 35). A barrel that re-exports an internal application service is a declared surface, but whether it is a "protocol" is not settled; Evans is silent on module re-exports.

**Options.**
- **A: literal (status quo).** An import through the declared barrel is public.
  - *Meaning:* the context declares its API by what its barrel exports, so the published interface is a declaration.
  - *Rule change:* none.
- **B: resolved. g02 is a violation too.**
  - *Meaning:* what crosses the boundary is the target file, and re-exporting an internal file does not make it a published interface.
  - *Rule change:* FF-DS02 also reports the resolved target of a barrel import when that target is not public. Rule ADR owed.
- **C: literal, plus a new advisory rule for a barrel that publishes an application service.**
  - *Meaning:* it keeps the declared API authoritative while flagging a barrel that exposes more than a model.
  - *Rule change:* new advisory rule (FF-DS03) for a public-API barrel that re-exports an application-layer file. Rule ADR and tier ADR (new row) owed.

**Example** (ddd g02, `billing/api/InvoiceController.ts`):
```ts
import type { GetOrderSummary } from '../../ordering/index.js';  // g03: '../../ordering/application/GetOrderSummary.js'
```

[Answer]: 

Reason (one or two sentences, sources only, no scores):

---

## Q18. May a DDD anti-corruption layer import upstream internals?

**Why it matters.** The sealed FF-DS02 row allows imports "only through the declared public API *or ACL*", which exempts the ACL folder. An ACL that imports an upstream context's internal value object (ddd n01) is therefore not a finding today. This is ambiguity 8.

**Sources.** **[SRS: DDD, bounded-context isolation]**: integration is translated by an anticorruption layer. **From the source check (verbatim):** the ACL "talks to the other system through its existing interface, requiring little or no modification to the other system" (*DDD Reference* 2015, p. 34). It translates; it does not reach inside. The source therefore argues **against** the sealed exemption: the exemption is broader than Evans, and if it is kept the thesis must say so. Evans also sanctions Shared Kernel, Conformist, Partnership and Customer/Supplier relationships (pp. 30–33), so the "public API or ACL" pair is itself narrower than Evans.

**Options.**
- **A: yes, as sealed (status quo).** The ACL folder is exempt.
  - *Meaning:* the sealed rule text grants the exemption, a spec can opt into the strict reading by declaring no ACL folder, and changing it now would be a construct change made after seeing the data.
  - *Rule change:* none; the thesis labels the exemption broader than Evans.
- **B: no. The ACL also goes through the public API.**
  - *Meaning:* in Evans the ACL translates what the other context publishes, so it has no licence to reach inside it.
  - *Rule change:* FF-DS02 reports an ACL file that imports another context outside its public API. This changes the sealed row's wording. Rule ADR owed.

**Example** (ddd n01, `billing/acl/OrderingAcl.ts`):
```ts
import { OrderId } from '../../ordering/domain/order/value-objects/OrderId.js';
```

[Answer]: 

Reason (one or two sentences, sources only, no scores):

---

## Q19. Aggregate boundary: does any import of an inner entity from outside count?

**Why it matters.** FF-DT01 reports any import of an aggregate's inner entity from outside the aggregate (ddd v01). An import edge cannot tell holding a reference from transient use. This is ambiguity 9.

**Sources.** **[SRS: DDD, aggregate boundary]**: "allow external objects to hold references to the root only (references to internal members passed out for use within a single operation only)" (*DDD Reference* 2015, p. 16; Evans 2003 ch. 6, about p. 128 *(recalled)*). Evans explicitly allows transient references, so "any import counts" is **stricter than Evans** (confirmed by the source check; cite p. 16). Vernon's ch. 10 rule concerns references *between* aggregates (by identity) and lists reasons to break it; cite Vernon only as a restatement of Evans for the root-only rule.

**Options.**
- **A: yes, any import counts (status quo), labelled stricter than Evans.**
  - *Meaning:* a static check cannot see how long a reference lives, so it reports every outside import.
  - *Rule change:* none; the thesis states the rule is stricter than Evans p. 16.
- **B: no. Report only references that are kept.**
  - *Meaning:* that is Evans's rule as written.
  - *Rule change:* FF-DT01 reports only when a class of the importing file holds the inner entity (a field via `FLOWS_TO`, or constructor injection). Rule ADR owed.

**Example** (ddd v01, `ordering/application/GetOrderSummary.ts`):
```ts
import type { OrderLine } from '../domain/order/OrderLine.js';
```

[Answer]: 

Reason (one or two sentences, sources only, no scores):

---

## Q20. Does domain purity (FF-P01) count transitive framework dependencies?

**Why it matters.** A domain file can reach a framework through a project file, for example a domain policy that imports a repository which imports `@nestjs/common` (nestjs v10). FF-S01, FF-S04 and FF-P06 already report the first edge.

**Sources.** **[SRS: Clean, FF-P01]** and **[SRS: DDD, isolated domain]**: the domain does not depend on frameworks. Martin speaks of what inner code *knows*, and Evans of the domain's dependencies; both are silent on transitive dependencies (source check, rows 1, 2 and 11). Martin does forbid passing framework data formats inward, which concerns data shape, not transitive imports.

**Options.**
- **A: no, direct imports only (status quo).**
  - *Meaning:* the transitive part is already a direction fault, owned by FF-S01 and FF-S04.
  - *Rule change:* none.
- **B: yes.**
  - *Meaning:* a domain that reaches a framework through one hop still depends on it at run time.
  - *Rule change:* a purity finding for any domain file that reaches a forbidden package through project files. Rule ADR owed.
  - **Scope note (switch build):** B is wider than the question first implied. Transitive closure turns essentially every outward edge from the domain into a purity finding as well, in every style that has a purity rule (clean, layered, nestjs, ddd), not only the nestjs v10 case. This is the P2 overlap in its general form.

**Example** (nestjs v10, `domain/registration-policy.ts`):
```ts
import { InMemoryRegistrationRepository } from '../registrations/in-memory-registration.repository';
private readonly history = new InMemoryRegistrationRepository();
```

[Answer]: 

Reason (one or two sentences, sources only, no scores):

---

## Q21. FF-DT05 domain-event placement: advisory or blocking?

**Why it matters.** FF-DT05 reports a domain event defined outside the domain layer (ddd v05). This is the DDD notes' proposed ADR 2.

**Sources.** `style-rule-sources.md` has no DDD row for event placement, and FF-DT05 has no source row (errata, "Missing rows"): if it blocks, it needs one before the freeze. The sealed tier table calls it a placement guideline. The DDD notes cite Vernon ch. 8 (events are domain objects), which is outside the table.

**Options.**
- **A: advisory, as sealed (status quo).**
  - *Meaning:* the table lists no defining-constraint source for event placement.
  - *Rule change:* none.
- **B: blocking.**
  - *Meaning:* Vernon makes events domain objects, so an event outside the domain breaks domain modelling.
  - *Rule change:* tier override to blocking, and a source row for FF-DT05. Tier ADR owed.

**Example** (ddd v05):
```ts
// src/billing/application/InvoiceIssued.ts
export class InvoiceIssued implements DomainEvent {
```

[Answer]: 

Reason (one or two sentences, sources only, no scores):

---

## Q22. Does FF-P02 count sibling-service injection (RDQ-3)?

**Why it matters.** FF-P02 is a ratio of injected abstractions with a 0.85 threshold, and it is advisory. A NestJS service that injects a sibling service of the same layer (nestjs n03) lowers that ratio.

**Sources.** No source row covers FF-P02. Martin's DIP (ch. 11) is **not** scoped to boundaries: source-code dependencies should refer to abstractions, not concretions, in general. **[SRS: Clean, FF-P03]** applies it *across a boundary*. **[SRS: NestJS]** ("Providers") shows injecting a same-layer service as standard practice.

**Options.**
- **A: yes, count all constructor dependencies (status quo).**
  - *Meaning:* this is DIP as Martin states it, with no boundary scope.
  - *Rule change:* none.
- **B: no. Count only dependencies on another layer.**
  - *Meaning:* a same-layer service is neither policy nor detail to its sibling, and the framework's documented practice injects it directly.
  - *Rule change:* the FF-P02 ratio is computed over dependencies in another layer only. This is a **narrowing** of Martin's DIP to its cross-boundary use; the thesis would say that FF-P02 measures DIP across layers only. Rule ADR owed.

**Example** (nestjs n03, `registrations/registrations.service.ts`):
```ts
import { WorkshopsService } from '../workshops/workshops.service';
    private readonly workshopsService: WorkshopsService,
```

[Answer]: 

Reason (one or two sentences, sources only, no scores):

---

## Q23. FF-P05: is an "entity" selected by its layer or by a name suffix?

**Why it matters.** FF-P05 (controller uses no entity, advisory) selects entities by an `Entity` name suffix. Domain classes such as `Loan` (clean v07) and `Workshop` (nestjs v09) have no suffix, so they are not entities to the rule (TDC-1).

**Sources.** No source row covers FF-P05; the tier table calls it a guideline (DTOs at boundaries). The declarations define entities by folder (`domain/entities/**`, `src/domain/**`).

**Options.**
- **A: by name suffix (status quo).**
  - *Meaning:* the suffix is an explicit marker in the code, and it needs no declaration to be read.
  - *Rule change:* none.
- **B: by the declared domain layer (entity role or folder).**
  - *Meaning:* the declaration is the architect's statement, and a suffix is only a naming habit.
  - *Rule change:* FF-P05's entity set becomes every class of the declared domain layer; the rule's reach is unchanged. Rule ADR owed.
  - **Note (switch build): B as implemented changes no detection.** The FF-P05 template finds entities only through **constructor injection**: its import hop joins class nodes and never matches (`edge-views.md`). The controllers in v07 and v09 name the entity in an import and a type annotation without injecting it, so changing the selector alone reaches nothing new. Making FF-P05 see such uses would also need an import reach, which no option here offers; that would be a separate rule change.

**Example** (clean v07, `infrastructure/http/LoanController.ts`):
```ts
import { Loan } from '../../domain/entities/Loan';
const loan: Loan | undefined = await this.loanRepository.findById(…);
```

[Answer]: 

Reason (one or two sentences, sources only, no scores):

---

## Q24. Is an *inward* bypass of the use-case layer a finding?

**Why it matters.** An adapter or controller that uses a domain type directly, or does work a use case could do, skips the use-case layer inward (hex n01, clean v07, nestjs v09). A related case, a lower-layer type exposed through the business API (layered v03), is covered by no rule. This is ambiguity 3.

**Sources.** **[SRS: Clean, FF-S01]** constrains direction only; Martin: "the circles are schematic … However, The Dependency Rule always applies" (blog 2012, "Only Four Circles?"), and nothing forbids an outer ring from using an inner ring two steps in. `rule-tiers.md` gives the FF-S03 reason: Clean and Hexagonal allow skipping inward. **[SRS: Hexagonal, port-adapter]** says actors talk through ports; using a domain value type is not talking to the application.

**Options.**
- **A: no (status quo).** Not FF-S03 or FF-P04. The controller-to-entity case belongs to FF-P05 (Q23); an exposed lower-layer type is out of scope.
  - *Meaning:* the styles permit inward dependencies.
  - *Rule change:* none.
- **B: yes, as an advisory FF-S03 finding when an adapter or controller does work that belongs to a use case.**
  - *Meaning:* business work done in an adapter bypasses the use case, which the port-adapter pattern is meant to route through.
  - *Rule change:* an advisory FF-S03 finding; in clean and nestjs, FF-S03 runs as a carrier for it. Rule ADR owed.
  - **Scope note (switch build):** B as implementable is wider than its wording. A static check cannot see "work that belongs to a use case", so the rule fires on **every controller or inbound-adapter file that imports a domain file**, including adapters that only parse or pass a domain value type. In hexagonal that is most inbound adapters, repeated across variants.

**Example** (hex n01, `adapters/inbound/http/RoomController.ts`):
```ts
import { DateRange } from '../../../domain/model/DateRange';
DateRange.parse(String(request.query['checkIn']), String(request.query['checkOut']));
```

[Answer]: 

Reason (one or two sentences, sources only, no scores):

---

## Q25. Files outside the layer model: should the presets declare their roles?

**Why it matters.** Some files fall outside the declared layers, and the tool is silent on them only because no glob binds them. A Study 2 project could fire on them. The cases:
- second composition roots: clean n01 `TestLibraryApp.ts`, hex n02 `testContainer.ts`;
- NestJS `*.module.ts` files that wire repository implementations;
- `main.ts`, the DDD `index.ts` and `contracts/**`, and `utils/**`;
- the NestJS `src/domain/waitlist.repository.ts`, which matches both a domain directory and an infrastructure file pattern.

These are ambiguities 6a, 6c, 12 and 13. **Interaction:** Q13 C is coherent only together with B here (see Q13).

**Sources.** The table is silent. **[SRS: NestJS]**: providers are wired in modules. Martin ch. 26 ("Main") is outside the table. Cockburn's sample wires adapters at configuration time (see Q5), which is the composition-root idea.

**Options.**
- **A: leave as is (status quo).**
  - *Meaning:* every preset change adds a chance of new behaviour before the hold-out.
  - *Rule change:* none.
- **B: declare them in the presets.**
  - *Meaning:* the behaviour is then stated, rather than an accident of the globs.
  - *Rule change:*
    - a `composition-root` role, exempt from the layer rules (`**/main.ts`, test containers, `**/*.module.ts`);
    - directory beats file pattern, as the NestJS preset's comment already says;
    - unassigned files are not checked by layer rules; in DDD, FF-DS01 reports them (Q15).
  - Procedure: as with Q16, **one** development-set run before the hold-out, with no second tuning loop; anything surprising goes into an ADR, not into code.

**Example** (nestjs n02, `src/domain/waitlist.repository.ts`):
```ts
/** A port that lives in src/domain/ but uses the *.repository.ts file name the preset maps to infrastructure. */
export interface WaitlistRepository {
```

[Answer]: 

Reason (one or two sentences, sources only, no scores):

---

## After answering

1. Check the sheet is still blind: `npx tsx scripts/v1.3/check-answer-sheet-blind.ts`.
2. Commit the filled sheet, then write ADR-V13-03 "construct decisions" from it, with a construct reason for every tier or rule move. Only then open `construct-switches.md` and apply the answers with `scripts/v1.3/apply-construct-answers.ts`.
3. Before sealing, resolve the ADR-V13-02 / NestJS preset contradiction (Q13 action item).
4. Q16 B and Q25 B: one development-set run each before the hold-out, with no second tuning loop.
