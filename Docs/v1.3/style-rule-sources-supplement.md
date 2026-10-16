# Supplement to style-rule-sources.md: rows for rules with no source row

**2026-10-16.** `Docs/v1.3/style-rule-sources.md` is sealed (sha256 in `Docs/v1.3/sealed-hashes.md`) and is not edited. This file adds the rows that `Docs/v1.3/rule-source-verification.md` ("Rules with no source row") and `Docs/v1.3/style-rule-sources-errata.md` ("Missing rows") found missing. The tiers come from the sealed `Docs/v1.3/rule-tiers.md` and the DDD preset (`presets/ddd.yaml`). **No tier is changed here.** Where a source is weak, or does not fit the current tier, that is recorded below as a finding for the author.

**Not an input to the blind manifest writer.** The validation protocol gives the blind writer only the sealed table. Whether this supplement is added to that input is a decision for the author. Adding it after manifests exist would change the blind input.

## What was read

- **Read directly, 2026-10-16:**
  - Evans, *Domain-Driven Design Reference* (2015, CC-BY), [PDF](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf). Page numbers are the printed page numbers. The PDF page is the printed page + 7.
  - Martin, ["The Clean Architecture"](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) (blog, 2012).
  - Cockburn, ["Hexagonal Architecture"](https://alistair.cockburn.us/hexagonal-architecture/) (2005).
  - NestJS docs, from the source files at github.com/nestjs/docs.nestjs.com (`master`): `content/controllers.md` and `content/components.md` ("Providers").
  - Fowler, bliki ["LocalDTO"](https://martinfowler.com/bliki/LocalDTO.html) (21 October 2004), and the PoEAA catalogue entry ["Data Transfer Object"](https://martinfowler.com/eaaCatalog/dataTransferObject.html).
- **Not accessible:** the books by Martin (2017), Fowler (2002), POSA 1 (1996), Evans (2003) and Vernon (2013). Book wording and page numbers for these are marked *(recalled)* and must be checked in print before thesis use. A web search for the ch. 11 DIP wording found no accessible copy. InformIT's excerpt is ch. 22 only.

## Rows (same format as the sealed table)

| Style | Rule | Source | Constraint (paraphrase) |
|---|---|---|---|
| Clean, NestJS | Dependency inversion ratio (FF-P02, advisory) | Martin, *Clean Architecture* (2017), ch. 11 "DIP" (about p. 87, *recalled*); Martin 2012 blog, "Crossing boundaries"; NestJS docs, "Providers" (dependency-injection warning) | Source dependencies should refer to abstractions, not to volatile concrete classes. Martin treats this as a principle, not a rule: stable concretes are acceptable *(recalled)*. The 0.85 threshold has no source. |
| Clean, NestJS | Use-case isolation (FF-P04, advisory) | Martin 2012 blog, "Use Cases"; Martin 2017, ch. 20 "Business Rules" and ch. 22 (*recalled* locators) | Use cases are isolated from the database, UI and frameworks. They orchestrate entities. Under the Dependency Rule they do not name outer-circle classes. |
| Clean, NestJS | Controller does not reference entities (FF-P05, advisory) | Martin 2012 blog, "What data crosses the boundaries"; Martin 2017, ch. 22, same section (*recalled*); Fowler, bliki "LocalDTO" (2004); PoEAA (2002) ch. 15 "Data Transfer Object"; NestJS docs, "Controllers" (DTO section) | Clean: only simple data structures cross boundaries, so entities are not passed out to controllers. Fowler: DTOs are for remote calls, and are harmful in a local service-layer API. NestJS uses DTOs for request bodies but does not forbid entities. The sources disagree. |
| Clean, Hexagonal, NestJS | Domain state purity (FF-P06, blocking, constructor half only) | Martin 2012 blog, "The Dependency Rule" and "Interface Adapters"; Evans, *DDD Reference* (2015), "Layered Architecture", p. 10; Cockburn 2005, "Intent" | A domain class does not hold, by injection, an object of the infrastructure layer: inner code does not mention outer names, and domain objects are free of the responsibility of storing themselves. Not applicable to Layered: Fowler (bliki 2015) and Evans 2003 ch. 4 let the domain use the layer below. |
| DDD | Domain-event placement (FF-DT05, advisory) | Evans, *DDD Reference* (2015), "Domain Events", p. 13 (not in the 2003 book); "Layered Architecture", p. 10; Vernon, *Implementing DDD* (2013), ch. 8 "Domain Events" (*recalled*) | Each domain event is represented as a domain object and is part of the domain model. Domain-model code is concentrated in one layer. Domain events are distinct from system events. |
| DDD | Every file lies in a declared context (FF-DS01, blocking in the DDD preset; no sealed tier row by id) | Evans, *DDD Reference* (2015), "Bounded Context", p. 2; "Shared Kernel", p. 31; Evans 2003, ch. 14 (*recalled*); Vernon 2013, ch. 2 and ch. 9 "Modules" (*recalled*) | A context's boundary is set explicitly, including in the code base. Code shared between contexts is designated with an explicit boundary. The sources do not say that every source file must belong to a context. |
| DDD | Cross-context imports only through the public API or ACL (FF-DS02, blocking) | Same construct as the sealed row "DDD, bounded-context isolation". Add Evans, *DDD Reference* (2015): "Context Map", p. 29; "Conformist", p. 33; "Anticorruption Layer", p. 34; "Open-host Service", p. 35. Vernon 2013, ch. 13 | Integration across contexts is explicit: through a published protocol, or translated by an anticorruption layer. Evans also sanctions Shared Kernel and Conformist, so the rule is stricter than Evans. The ACL exemption is broader than Evans. |
| Clean, NestJS (DDD: not applied) | Domain does not depend outward (FF-S04, blocking) | Clean: Martin 2012 blog, "The Dependency Rule"; Martin 2017, ch. 22. DDD (if ever applied): Evans, *DDD Reference* (2015), p. 10. NestJS: no NestJS source | Nothing in the domain names anything in an outer layer. In DDD the same edges are owned by FF-S01 `dependency-direction-graph` (construct-decisions Q11 A, P2), and `presets/ddd.yaml` has no FF-S04. |

## Per-rule evidence

### FF-P02 `dependency-inversion` (advisory). Source adequate; it supports the tier

- **Template:** for each application-layer class with constructor-injected dependencies, the share of injected types that are interfaces. It reports the class when the share is below 0.85.
- **Martin 2017, ch. 11** *(recalled; check in print)*:
  - The most flexible systems are those whose source dependencies refer only to abstractions.
  - Treating this as a rule is unrealistic, because systems must depend on concrete facilities. The ones to avoid are *volatile* concrete classes. Stable ones, such as `String`, are fine.
  - The coding practices are "Don't refer to volatile concrete classes", "Don't derive from volatile concrete classes", and so on.
- **Blog, verified:** "We usually resolve this apparent contradiction by using the Dependency Inversion Principle." DIP is the *mechanism* for the Dependency Rule at a boundary. It is not a separate constraint.
- **NestJS, "Providers", verified:**
  - Quote: "the annotation must refer to something that exists at runtime, that is, a **class**. Interfaces and type aliases are erased during compilation."
  - To inject a non-class, "register it under a token and inject it explicitly with `@Inject()`".
  - So injecting concrete classes is the framework's documented default. A ratio rule fights that default.
- **Finding:** none against the tier. Martin's own hedge (stable concretes are fine) and the unsourced threshold make this a proxy. Advisory is well supported. The volatility distinction is not observable in the graph, so the thesis should say so.

### FF-P04 `use-case-isolation` (advisory). Source strong for the construct; the tier is defensible on P2 and proxy grounds

- **Template:** an application-layer class whose name contains a use-case role (`UseCase`, `Service`, `Handler`), and which injects a dependency from a layer other than domain or application.
- **Blog, "Use Cases", verified:**
  - "We also do not expect this layer to be affected by changes to externalities such as the database, the UI, or any of the common frameworks. This layer is isolated from such concerns."
  - "These use cases orchestrate the flow of data to and from the entities".
- **Finding (for the author):**
  - In Clean, Martin states use-case isolation as a constraint, not a guideline. So the sealed reason ("Design guideline, not a defining constraint") does not match the Clean source.
  - Advisory is still defensible on two grounds that `rule-tiers.md` accepts:
    1. The rule selects classes by name (`$useCaseRoles`), so it is a naming proxy.
    2. Every edge it reports is a use case → outer-layer edge, which FF-S01 already reports as blocking. Principle P2 (one edge, one rule) argues against a second blocking rule for the same edge.
  - Record that the construct is defining in Clean but is owned by FF-S01.
  - For NestJS, the docs are silent on use cases.

### FF-P05 `controller-no-entity` (advisory). Sources conflict; the tier is defensible

- **Template:** a controller-layer class that reaches a domain class whose name contains an entity role, within 1–2 IMPORTS or CONSTRUCTOR_INJECTS hops. A v1.3 signature-type branch is off by default (`Docs/v1.3/ffp05-type-edges.md`).
- **Blog, "What data crosses the boundaries", verified:**
  - "The important thing is that isolated, simple, data structures are passed across the boundaries. We don't want to cheat and pass Entities or Database rows."
  - The section ends: "Conforming to these simple rules is not hard". The book's ch. 22 has the same section *(recalled)*.
- **Fowler, "LocalDTO" (2004), verified:**
  - "Not just do you not need them in a local context, they are actually harmful".
  - He quotes Stafford: "start with a locally invocable Service Layer whose method signatures deal in domain objects."
- **PoEAA catalogue, verified:** a DTO is "An object that carries data between processes in order to reduce the number of method calls."
- **NestJS "Controllers", verified:**
  - Quote: "A DTO is an object that defines the shape of data sent over the network."
  - The docs use DTOs for request bodies. They do not forbid a controller returning or naming an entity.
- **Findings (for the author):**
  1. **Possible tier tension in Clean.** Martin calls this one of the "rules", in the blog and *(recalled)* in ch. 22. For Clean, the sealed reason "Guideline … styles differ on it" understates the source. "Styles differ" is accurate *across* sources: Fowler argues against DTOs in local layered systems.
  2. Martin's rule is about the data passed across a boundary. A controller naming an entity type is an outer → inner reference, which the Dependency Rule allows. So the template (a reference by name and role) is a proxy for Martin's constraint, not the constraint itself. Advisory is defensible on that ground. The thesis should give that reason, not "guideline".

### FF-P06 `domain-state-purity` (blocking, partial). Source adequate for Clean and Hexagonal; weak for NestJS

- **Template:** a domain-layer class with a FLOWS_TO (field) or CONSTRUCTOR_INJECTS edge to an infrastructure-layer Class or Interface. The sealed tier keeps only the constructor-injection half. The FLOWS_TO half is reported N/A (construct-decisions Q8 B).
- **Blog, verified:**
  - "Nothing in an inner circle can know anything at all about something in an outer circle."
  - "No name in an outer circle can be mentioned by an inner circle."
  - An injected parameter typed as an infrastructure class mentions that name.
- **DDD Reference p. 10, verified:**
  - "eliminate any dependency on infrastructure"
  - "The domain objects, free of the responsibility of displaying themselves, storing themselves, managing application tasks, and so forth, can be focused on expressing the domain model."
- **Cockburn, "Intent", verified:** "The application is blissfully ignorant of the nature of the input device."
- **Is the blocking tier defensible?**
  - **Clean and DDD: yes.** It is the Dependency Rule and Evans's isolation, applied to held state. It is a precise edge fact. DDD is listed in `V13_STYLE_APPLICABILITY`, but `presets/ddd.yaml` does not declare FF-P06, so it has no effect there now.
  - **Hexagonal: yes, with a caveat.** Cockburn's own sample holds a `RateRepository` interface declared in a package `repository`, outside the application (rule-source-verification row 6). If a spec places port interfaces in the infrastructure layer, the template (which matches `t:Interface`) is stricter than Cockburn's sample. Declare it as stricter, or exclude interfaces in hexagonal.
- **Findings (for the author):**
  1. **P2 overlap.** A constructor parameter typed with an infrastructure class normally has an import edge that FF-S01 or FF-S04 already reports. The exceptions are a type-only import, where FF-S01 counts it anyway (construct-decisions Q2), and a type in the same file. FF-P06 therefore adds little blocking evidence of its own. Say which rule owns the edge.
  2. **NestJS: weak.** The NestJS docs say nothing about a domain layer (rule-source-verification row 13). FF-P06 blocks in `nestjs` only because the preset adopts Clean layering (ADR-V13-02), which the docs do not support. Its blocking status there rests on Martin, through the preset, not on any NestJS source. State that in the thesis.
  3. **Layered N/A is source-backed.** The Fowler bliki says "presentation depends on the domain, which then depends on the data source" (verified in the earlier report), and in Evans 2003 ch. 4 infrastructure is below the domain *(recalled)*. POSA 1 Layers (ch. 2 §2.2, *recalled*) puts no purity constraint on a layer.

### FF-DT05 `domain-event-placement` (advisory). Source stronger than recorded; the tier is contestable

- **Template:** a class that implements or extends (directly or transitively) a declared domain-event type, and that is not in a domain layer.
- **DDD Reference p. 13, verified:**
  - "Therefore: Model information about activity in the domain as a series of discrete events. Represent each event as a domain object."
  - "A domain event is a full-fledged part of the domain model, a representation of something that happened in the domain."
  - The pattern is starred in the Reference's table of contents, which marks patterns not in the 2003 book. So Evans 2003 cannot be cited for it.
- **DDD Reference p. 10, verified:** "Concentrate all the code related to the domain model in one layer".
- **Vernon 2013 ch. 8** *(recalled)*: events are modelled in the domain and published by aggregates.
- **Finding (for the author):** construct-decisions Q21 says that "no source in the table states event placement as a constraint". That is true of the *sealed table* only. Evans 2015 puts it in two verbatim steps: an event is part of the domain model (p. 13), and domain-model code is concentrated in the domain layer (p. 10).
  - The sealed advisory reason ("placement guideline") is therefore contestable. It is a two-step inference, not one sentence. The DDD notes (§2, proposed ADR 2) reached the same view.
  - **Caveat that supports keeping it advisory:** the Reference separates domain events from "system events that reflect activity within the software itself". An application-layer integration event that implements the declared `DomainEvent` type is a declaration error in the spec, not a model violation. The rule cannot tell the two apart.
  - Not changed here. If the author moves it, that needs an ADR on construct grounds (`rule-tiers.md`).

### FF-DS01 `bounded-context-modules` (blocking in the DDD preset). Source weak; the blocking tier is the least defensible of this set

- **Template:** a file under the source root that is in no declared context root and matches no path declared outside the contexts.
- **DDD Reference p. 2, verified:** "Explicitly define the context within which a model applies. Explicitly set boundaries in terms of team organization, usage within specific parts of the application, and physical manifestations such as code bases and database schemas."
- **DDD Reference p. 31, verified:** "Designate with an explicit boundary some subset of the domain model that the teams agree to share."
- **DDD Reference p. 15 ("Modules"), verified:** this is about cohesive concepts inside a model, not about contexts. It does not support the rule.
- **Is the blocking tier defensible? Weakly.**
  - Evans requires a context's boundary to be explicit, and shared *model* code to be designated.
  - Evans does not say that every file belongs to some context. Non-model code is not addressed: a composition root, a formatting helper, generic infrastructure. A stray `utils/formatCurrency.ts` (ddd v07) is undesignated shared code only if it is model code.
  - The rule is a precise fact over the declarations. The *construct* behind it is a project convention ("declare every top-level folder"). That fits the sealed principle's advisory clause ("a naming or project convention") at least as well as the blocking one.
- **Findings (for the author):**
  1. FF-DS01 has no row by id in the sealed `rule-tiers.md`. Its blocking tier comes from the DDD notes, which were written before the seal was seen (`Docs/v1.3-ddd-notes.md` §2).
  2. The sources found give it only a weak construct basis. This supports construct-decisions Q15's caveat: either decide the tier by ADR before the freeze, or report FF-DS01 findings separately from the blocking verdict until it is decided.
  3. The recommendation in Q15 (A, defer) stays the author's call. This file only records that the source does not carry the blocking reading on its own.

### FF-DS02 `context-isolation` (blocking). Covered by the sealed row; tier defensible if declared stricter than Evans

- **Template:** an import or re-export from context A to context B (A ≠ B). It is reported unless the target is in B's declared public API, or the target is re-exported by it (the M1 barrel clause), or the importer is in A's declared ACL.
- **Mapping:** FF-DS02 is the sealed row "DDD, bounded-context isolation" (sealed tier row: "DDD bounded-context isolation (imports only through the declared public API or ACL)", blocking). The gap was the missing id, not a missing source.
- **DDD Reference, verified:**
  - p. 35, Open-host Service: "Define a protocol that gives access to your subsystem as a set of services."
  - p. 34, ACL: "This layer talks to the other system through its existing interface".
  - p. 33, Conformist: "slavishly adhering to the model of the upstream team".
  - p. 31, Shared Kernel: an explicitly bounded shared subset.
- **Is the blocking tier defensible? Yes, as a declared rule that is stricter than Evans.** Explicit integration across contexts is defining (p. 2, p. 29). The rule forbids Conformist-style direct use, which Evans permits, so the thesis must say the rule is stricter. The ACL exemption lets an ACL file import B's internals. That is **broader** than Evans (p. 34), as the errata already say.

### FF-S04 `no-domain-outward-dep` "in DDD". No row needed for DDD; NestJS has no source

- **Template:** a domain-layer file that imports a file in any other layer. Applicable to `clean-architecture` and `nestjs` only (`CLEAN_AND_NESTJS`). The hexagonal preset's FF-S04 is `core-isolation`, which is covered by the sealed Hexagonal row.
- **DDD:** `presets/ddd.yaml` declares no FF-S04. Construct-decisions Q11 recommends A: FF-S04 stays out of DDD, and FF-S01 owns domain → outer edges (P2). If it were added, the source would be the DDD Reference p. 10 (verified): "eliminate any dependency on infrastructure, user interface, or even application logic that is not business logic". **No DDD row is needed unless Q11 is decided otherwise.**
- **Clean:** the sealed table cites FF-S04 only in the Hexagonal row. For Clean, the source is the Dependency Rule (sealed row "Clean, FF-S01"). Blocking is defensible.
- **Finding (for the author):** in NestJS, FF-S04 blocks on a domain layer that the NestJS docs never define. It rests on the preset's Clean reading (ADR-V13-02), which rule-source-verification row 13 found the docs contradict: the TypeORM example injects a repository into a service. As with FF-P06, give the source as "Martin, through the preset", and say that NestJS itself is silent.

## Summary of findings

| Rule | Tier (current) | Source strength | Tier defensible? | Finding |
|---|---|---|---|---|
| FF-P02 | advisory | Adequate; Martin ch. 11 *(recalled)*, NestJS verified | Yes | Sources support advisory. The threshold is unsourced. |
| FF-P04 | advisory | Strong for Clean (blog, verified) | Yes, on proxy and P2 grounds | The sealed reason ("guideline") is weaker than Martin's wording. Cite the P2 and proxy reasons instead. |
| FF-P05 | advisory | Strong for Clean (blog, verified); Fowler against | Yes, on proxy grounds | Martin calls it a rule. The sealed "guideline" reason understates the source in Clean. |
| FF-P06 | **blocking (partial)** | Adequate for Clean, DDD, Hexagonal; none for NestJS | Yes in Clean and DDD. Hexagonal: declare it stricter for interfaces. NestJS: weak | P2 overlap with FF-S01/S04. NestJS rests on the preset, not the docs. |
| FF-DT05 | advisory | Strong (Reference pp. 10, 13, verified) | Contestable | The source supports a blocking reading. Q21's literature line is incomplete. |
| FF-DS01 | **blocking** (preset; no sealed id row) | **Weak** | **Weakly** | The weakest blocking rule. Decide by ADR before the freeze, or report it outside the blocking verdict (Q15 caveat). |
| FF-DS02 | **blocking** | Adequate (sealed row + Reference pp. 29–35, verified) | Yes, declared stricter than Evans | Id mapping only. The ACL exemption is broader than Evans. |
| FF-S04 | **blocking** (Clean, NestJS; not in DDD) | Clean adequate; DDD n/a; NestJS none | Clean yes; NestJS weak | No DDD row needed (Q11 A). NestJS rests on the preset. |

## Before thesis use: what to check in print

1. Martin 2017:
   - ch. 11: the "most flexible systems", "unrealistic as a rule" and "volatile concrete classes" passages, with the page;
   - ch. 20 and ch. 22: use-case isolation;
   - ch. 22: "Which data crosses the boundaries".
2. Fowler 2002, ch. 15 "Data Transfer Object" (about p. 401) and the Stafford remark in ch. 9 "Service Layer". *(recalled locators)*
3. Evans 2003, ch. 14: Bounded Context and Shared Kernel, with pages.
4. Vernon 2013:
   - ch. 8: the placement of domain events in the domain model;
   - ch. 9: Modules, one context per module;
   - ch. 13.
