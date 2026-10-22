# DETECT-01: what the instrument can detect, family by family, and what it would take to close the gaps

**Status:** coverage map v1, 2026-10-21, written **before any detector code** (step 2 of DETECT-01). Exploratory,
thesis repo. Zero model calls were made for this note. Nothing here changes the instrument: `src/`, `presets/`,
`scripts/lib/`, `scripts/v1.3/`, the tag `v1.4-freeze-2026-10-20` and every Study 2b path stay as they are. Any
detection this note recommends is a versioned change for **after** the Study 2b scoring, never retroactive to 2b.
Comments go in `> AUTHOR:` lines.

**Inputs.** Families H1–H7 and D1–D11 and the detectability table: `ops/notes/hexddd-01-violation-elicitation-design.md`
§3 (the families are listed in §3, with the scenarios in §4). The nine hand-read misses:
`results/v1.4-pilot-hexddd-01/hand-read-log.csv` on `pilot/hexddd-01` (PR #332, commit `c1805364`). The scorer output:
`results/v1.4-pilot-hexddd-01/scores/` on the same branch (opened only now; the hand read is complete). The instrument:
`presets/hexagonal.yaml`, `presets/ddd.yaml`, the extractor `src/apg-extractor/` (C1a), the C4 prompt
`src/apg-enrich/ontology/interpretation.ts`.

## 0. Classes and the facts the extractor emits today

Classes (per the task): **(a)** detected today, with the rule and its tier; **(b)** symbolically detectable with a new
rule, naming the graph facts it needs and whether the extractor emits them; **(c)** semantic only (a C4-style question
is drafted); **(d)** out of reach, with the reason.

Facts in the instrument's extraction (`V13_DEFAULT_OPTIONS`), checked by running the extractor on the rebuilt S2 step-5
tree (`experiments/detect-01/`, no model call):

| Fact | Emitted? | Note that matters here |
|---|---|---|
| `File`, `Class`, `Interface`, `Method`, `Function`, `Package` nodes; `IMPORTS` (line, `isTypeOnly`, `importedNames`), `DECLARES`, `CONTAINS`, `EXTENDS`, `IMPLEMENTS`, `CONSTRUCTOR_INJECTS`, `FLOWS_TO` | yes | — |
| `CALLS` (Method → Method) | yes, **class methods only** | `edge-extractor.ts:281-323`: a call is kept only when its target declaration is a `MethodDeclaration` inside a `ClassDeclaration`. A call through a port (`this.invoices.save(x)` with `invoices: InvoiceRepository`, an interface) writes **no edge**. On the S2 step-5 tree, 68 CALLS edges and none of them reaches a repository or a port. Every use case in a hexagonal or DDD tree calls its repositories through an interface, so the write path of D4 is invisible today |
| Member facts (`fields`, `publicFields`, `setAccessors`, `mutatorMethods`, `fieldsAssignedOutsideConstructor`; Method `visibility`, `assignedFields`) | yes (`memberFacts`) | Read only by FF-DT03 (value-object classes) |
| `SIGNATURE_USES` (Method/Function → Class/Interface, `positions`, `publicSurface`) | **only with `apg2: true`** (`V13_APG2_OPTIONS`), off in the instrument | Includes interface method signatures (port methods). Targets are project Class/Interface nodes only: a type declared in a `.d.ts` (vendored SDK typings) or under `node_modules` has no node, so a vendor type in a port signature writes no edge |
| `HOLDS_STATE_OF` | only with `fieldState` | — |
| `PUBLISHES` / `SUBSCRIBES` (Channel), `PERFORMS_IO`, `Component`, `EXPORTS_SYMBOL`, `DEEP_IMPORT` | only with `apg2` | Channels are recognised from known bus/emitter APIs; an in-house `EventBus` port is not a Channel |
| Statement-level facts (a `throw` guarded by a comparison, the shape of an object literal a method returns, structural equality of two types) | **no** | Needed by D5 and D9 below |

## 1. Families

| Family | Class | Today (rule, tier) or what is needed | Facts needed → emitted today? |
|---|---|---|---|
| **H1** Domain imports a framework or ORM | **(a)** | FF-P01 domain-purity (blocking), FF-DT04 in DDD (blocking), FF-P06 constructor half | IMPORTS to Package → yes |
| **H1b** Domain imports a vendor SDK not on the list | **(a) once the spec lists it**, else (b) | A spec parameter (`forbidden_imports`), as the pilot did for `@paystream/node` and `sqlwell`. An allowlist mode for domain imports would make it spec-free (rule change) | IMPORTS to Package → yes |
| **H2** Application imports an adapter | **(a)** | FF-S01 (blocking), FF-S04 under Q6 B | yes |
| **H3** Adapter → adapter | **(a)** | FF-S01 under Q5 C (blocking); FF-S03 sealed (advisory) | yes |
| **H4** Adapter with no port; use case on a concrete adapter | **(a)** / advisory | FF-P03 (blocking); FF-P02 (advisory ratio, mixed construct) | yes |
| **H5** Port shaped by infrastructure | **(a)** only when the port file imports a listed package (FF-P01 / post-seal application purity). Otherwise **(b)** for the *type* form, **(c)** for the *semantic* form | **(b)** A port method (interface under `ports/`, or an interface an outbound adapter implements) whose parameter or return type resolves to a declaration in an external module (vendored `.d.ts` `declare module`, or `node_modules`) or to an adapter-layer type. Needs SIGNATURE_USES **plus** external targets: APG v2 drops them (no node). New experimental fact: `SIGNATURE_USES_EXTERNAL {module}`. **(c)** A port whose contract carries a mechanism (a lock, a unit of work, a transaction callback) with no infrastructure *type*: the pilot case, see §2 row 4 | partly: SIGNATURE_USES behind `apg2`; external targets **no** |
| **H6** Business logic in an adapter or controller | **(c)** | Question Q-H6 (§3). A weak symbolic proxy exists (a controller method with arithmetic or a `throw` guarded by a comparison, see D5 below) | statement facts → no |
| **H7** Cycles domain ⇄ infra | **(a)** | FF-S02 (blocking; DDD post-seal Q16 B) | yes |
| **D1** Aggregate bypassed | **(a)** at file grain; (b) at declaration grain | FF-DT01 (blocking). Declaration grain needs `CONTAINS`/`DECLARES` per class plus a reference from outside the root's file to an inner entity class (design §8 item 5) | yes (DECLARES, IMPORTS `importedNames`) |
| **D2** Repository for a non-root | **(a)** file grain, weak reach | FF-DT02 (blocking, not beta-ready) | yes |
| **D3** Anemic model / logic in application services | advisory + **(c)** | FF-DT06 application-service-thin (advisory, method count), FF-SO01 (advisory). An "entity without behaviour" rule is (b): a domain class whose public methods are all accessors or setters (`mutatorMethods`, `getAccessors`, `setAccessors` → yes). *Logic placed in the service* (the pilot case) is (c): Q-D3 | member facts → yes; logic placement → no |
| **D4** One flow changes two aggregates, no outbox | **(b)** | Rule: an application method from which, through synchronous calls, **two repository write methods of different aggregates** are reached, with no event, outbox or message port on the path that separates them. Needs (1) calls through interfaces, (2) dispatch from an interface method to the class methods that implement it (class-hierarchy analysis over `IMPLEMENTS`), (3) repository write methods (an interface named `*Repository` with a `save`/`add`/`update`/`put`/`store`/`saveX` method) and the aggregate each one writes (SIGNATURE_USES of the write parameter). A second form: **one repository write method whose parameters carry two aggregate types** (the S1 case). Emitted today: IMPLEMENTS and the repository interfaces yes; SIGNATURE_USES behind `apg2`; **calls through interfaces no**. New experimental fact: `CALLS_PORT` (Method → interface Method) | partly (see left) |
| **D5** Invariant broken or checked outside the aggregate | **(a)** for value-object mutability (FF-DT03, blocking); **(b)** for the *check* form; **(c)** for the rest | **(b)** An application-layer method that throws under a numeric range or integrality guard (`x < 0`, `x > 1`, `!Number.isInteger(x)`), i.e. a domain rule stated outside the domain; stronger when the same guard (normalised) also appears in a domain class (duplication, overlaps D10). Needs a new statement fact `GUARDS {kind, normalised condition, line}` on Method nodes → **no**. **(c)** An invariant held by an application-level mechanism (the S1 in-process lock): Q-D5 | no |
| **D6** Bounded-context leakage | **(a)** | FF-DS02, FF-DS01 (blocking) | yes |
| **D7** Shared kernel misused | **(b)** | FF-DS02 ignores non-context files (DDD-BETA §A.1). Rule: a shared-kernel file that imports a context, or that declares a type with a context's name; the kernel's growth across steps | IMPORTS → yes; spec must name the kernel |
| **D8** Repository returning ORM entities | **(a)** through the import (FF-DT04); **(b)** otherwise | Repository port method whose return type is external (same `SIGNATURE_USES_EXTERNAL` as H5) | partly |
| **D9** DTO/entity confusion at the boundary | **(b)** | Two forms. (i) A published contract (a context's `contracts/` or public-API file, or an inbound port's view type) whose exported type has a property or method signature typed by a **domain class**: SIGNATURE_USES covers methods (behind `apg2`); property types are **not** emitted. (ii) A **domain** class whose public method returns an object type with **the same property names** as a published contract type (the aggregate shapes itself to the view; the pilot case). Needs property-name sets of anonymous return types and of contract interfaces → **no** | partly |
| **D10** One concept modelled twice; one rule duplicated | **(c)**, with a (b) slice | SEM-DUP / SEM-FRAG (C1d). The guard-duplication slice of D5(b) is symbolic | no |
| **D11** Domain events outside the domain | advisory | FF-DT05 (advisory) | yes |

**Count.** Of 19 rows (H1–H7 with H1b, D1–D11): 9 are detected today in some form, blocking (H1, H1b with the spec,
H2, H3, H4, H7, D1, D2, D6); D3 and D11 only through advisory proxies; H5, D4, D5, D7, D8, D9 have a symbolic route
(b); H6, D10 and parts of H5, D3, D5 are semantic only (c). No family is wholly out of reach (d); the (d) cases are
specific *instances* (§2).

## 2. The nine hand-read misses

Provenance: `pilot/hexddd-01` commit `c1805364`, the step diffs `results/v1.4-pilot-hexddd-01/diffs/<task>/step-NN.diff`;
line numbers are on the new side of the step diff. The tenth log row (S1 step 5, H4) records a **fixed** planted debt
and is not a miss.

| # | Case | Family | Class | Rule needed / question | Facts → emitted today? |
|---|---|---|---|---|---|
| 1 | S1 step 2 `src/application/services/BookRoomService.ts:37`: the no-overlap rule held by an in-process per-room promise lock in the application service | D5 | **(c)**; (d) for certainty | Q-D5. No type, import or call fact distinguishes "a lock that protects an invariant" from any other promise chain; the reader's own confidence is low | — |
| 2 | S1 step 3 `src/application/ports/out/BookingRepository.ts:11`: `saveAudited(booking, entries)` writes Booking and AuditRecords as one unit | D4 | **(b)** (repository form) | X1b: a repository write method whose parameters carry ≥ 2 aggregate types. Aggregate in a hexagonal tree (no aggregate declaration): a domain-model class with an identity field (`id`) that is not a value object. Needs SIGNATURE_USES (behind `apg2`) and member facts (yes). Whether AuditRecord is "its own aggregate" is the reader's caveat: the rule can only say "two identity-bearing domain types" | partly (`apg2`) |
| 3 | S1 step 4 `src/application/services/OccupancyReportService.ts:39`: revenue-spreading rule in the application service | D3 | **(c)** | Q-D3. A proxy (arithmetic on an entity's getters inside a service) would flag most report code; the read itself calls it defensible for a read model | — |
| 4 | S1 step 5 `src/application/ports/out/BookingRepository.ts:16`: `withRoomLock(roomId, task)` puts a lock / unit of work into the driven port | H5 | **(c)** | Q-H5. No vendor type leaks (the reader notes it), so the type-based H5 rule (X2) does **not** fire by design. A lexical proxy (`lock`, `transaction`, `unitOfWork` in a port method name, or a callback parameter typed by the port itself) is possible but unprincipled | — |
| 5 | S2 step 1 `src/billing/application/RecordPayment.ts:15`: saves the Invoice, then synchronously marks the Order paid through `OrderingPaidAcl` → `MarkOrderPaid` (two aggregates, two contexts, no outbox) | D4 | **(b)** | X1: path `RecordPayment.execute` → `InvoiceRepository.save` and `RecordPayment.execute` → `OrderPaidNotifier.orderPaid` ⇒ `OrderingPaidAcl.orderPaid` → `OrderPaidCommand.markPaid` ⇒ `MarkOrderPaid.markPaid` → `OrderRepository.save`. Needs `CALLS_PORT` (no), dispatch over IMPLEMENTS (yes), repository writes (SIGNATURE_USES, `apg2`) | **no** (calls through interfaces) |
| 6 | S2 step 2 `src/ordering/application/PlaceOrder.ts:35`: quantity and unit-price rules re-checked in the application service | D5 | **(b)** | X4: application-layer `throw` guarded by `!Number.isInteger(q) \|\| q <= 0`; the same guard sits in `Quantity` (duplication). Needs `GUARDS` (no) | no |
| 7 | S2 step 4 `src/ordering/application/SetTaxRate.ts:8`: tax-rate range rule (0..1) in the application service, no value object | D5 | **(b)** | X4: `rate < 0 \|\| rate > 1` guard before a throw in an application method | no |
| 8 | S2 step 5 `src/billing/application/IssueInvoice.ts:20`: saves the Invoice, then synchronously marks the Order invoiced (`OrderingInvoicedAcl` → `MarkOrderInvoiced`) | D4 | **(b)** | X1, same path shape as case 5 | **no** |
| 9 | S2 step 5 `src/ordering/domain/order/Order.ts:89`: the aggregate exposes a presentation-shaped `lineViews()` that `GetOrderSummary.ts:13` passes straight into the published `OrderSummary` contract | D9 | **(b)** | X3 form (ii): `Order.lineViews` returns an object type whose property names equal those of the contract's `OrderLineSummary` (6 of 6). Needs return-type property sets and contract type property sets (no) | no |

**Totals.** (a) 0 of 9 (by construction: they are misses). **(b) 6 of 9** (cases 2, 5, 6, 7, 8, 9). **(c) 3 of 9**
(cases 1, 3, 4). **(d)** none outright; case 1 is (d) if certainty is required. Every (b) case needs at least one fact
the instrument does not emit with its frozen options: calls through interfaces (cases 5, 8), SIGNATURE_USES (behind a
flag; cases 2, 9), statement-level guards (6, 7), structural shape of return types (9).

## 3. Draft C4-style questions for the (c) cases

All questions share one contract: answer `present`, `absent` or `abstain`; when `present`, cite at least one
`file:line` that holds the evidence, quoting the line; abstain when the code shown does not settle it. The verdict is a
**fact proposal**, not a finding (C4 never sets a verdict, N1).

- **Q-D5 (invariant outside its consistency boundary).** "Is there a business invariant of a domain object (a rule that
  must always hold for the object's state) that is enforced, checked or protected in the application layer or an adapter
  instead of inside the domain object or a value object? Include duplicated checks and application-level locks that
  exist only to keep a domain rule true."
- **Q-D3 (logic in application services).** "Does an application service contain domain calculation or decision logic
  (pricing, allocation, splitting, state rules) that operates on a domain object's data and could live on that domain
  object or a domain service? Plain orchestration (load, call, save, map to a view) does not count."
- **Q-H5 (port shaped by infrastructure).** "Does a port interface (driven or driving) expose a mechanism of one
  particular technology or deployment (a lock, transaction, unit of work, connection, SQL, HTTP or vendor type or
  concept) in its method names, parameters or return types, rather than an application-level need?"
- **Q-D4 (cross-aggregate write, also used as the semantic cross-check of X1).** "Does one application request change
  and persist two different aggregates (or aggregates in two bounded contexts) synchronously in the same call flow,
  without a domain event dispatched later, an outbox or a message between them?"
- **Q-D9 (DTO / entity confusion at the boundary).** "Does a domain object expose presentation- or contract-shaped
  data (a view or DTO shape), or does a published contract expose a domain object's type, so that the boundary between
  the domain model and the published language is blurred?"
- **Q-H6 (logic in an adapter).** "Does an inbound or outbound adapter contain business rules (not translation,
  validation of transport format, or wiring)?" (not exercised in DETECT-01: no hand-read case.)

## 4. Cross-check against `scores/`: did an advisory finding touch a hand-read case?

Read from `results/v1.4-pilot-hexddd-01/scores/` (`c1805364`). No **blocking** finding matches any of the nine (S1 has only
the planted FF-S01 through step 4; S2 has only the planted FF-DS02). Advisory findings in the same **file** as a case:

| Case | Advisory finding in that file | Since | Does it touch the construct? |
|---|---|---|---|
| 1 `BookRoomService.ts` (D5) | FF-C02 module-fan-out, FF-C03 component-instability | seed (step 0) | No: coupling metrics present before the lock existed |
| 2, 4 `ports/out/BookingRepository.ts` (D4, H5) | **FF-SO02 interface-segregation-proxy** (more than 5 interface methods) | step 1 | **Partial, file grain.** It fires because the port grew wide (step 1, before either case). It neither moves at step 3 (`saveAudited`) nor at step 5 (`withRoomLock`), so it carries no signal about the two violations; a reader directed to the file would find them |
| 3 `OccupancyReportService.ts` (D3) | FF-CV03 naming-repos | step 4 | No: a naming convention proxy |
| 5 `RecordPayment.ts` (D4) | — | — | No finding (S2 has no advisory findings at any step) |
| 8 `IssueInvoice.ts` (D4) | blocking FF-DS02 at `IssueInvoice.ts:7` (the **planted** debt: imports ordering's `Order`) | seed | No: same file, different construct; the planted import predates the case |
| 6, 7, 9 | — | — | No |

So the advisory layer touched 2 of 9 cases only by sharing a file, and through a construct (interface width) that does
not encode either violation. FF-DT06 (application-service-thin), the advisory meant for D3, did not fire in S2 at any
step.

## 5. What DETECT-01 builds next (steps 3–5)

Symbolic prototypes, zero model calls, all under `experiments/detect-01/`, with an **experimental extractor** that adds
the missing facts (`CALLS_PORT`, `SIGNATURE_USES_EXTERNAL`, `GUARDS`, `RETURNS_SHAPE`, contract property sets) next to
the instrument's own extraction, imported read-only:

| Id | Detector | Families | Cases |
|---|---|---|---|
| X1 | Synchronous cross-aggregate write without an outbox (call graph through ports, CHA dispatch); X1b: repository write method with two aggregate types | D4 | 2, 5, 8 |
| X2 | Infrastructure / vendor type in a port signature | H5 (type form), D8 | none of the nine (case 4 is the semantic form); evaluated on derived variants |
| X3 | Domain type or view shape in a published contract | D9 | 9 |
| X4 | Domain rule guard in an application service (and its duplicate in the domain) | D5 (check form), D10 slice | 6, 7 |

Semantic prototypes: Q-D5, Q-D3, Q-H5, Q-D4, Q-D9 on the fixtures (cap 40 `claude -p` calls in all).
