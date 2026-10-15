# Rule-source verification: `Docs/v1.3/style-rule-sources.md`

**Date:** 2026-10-15. **Scope:** the 13 rows of `DaedalusArch-v13/Docs/v1.3/style-rule-sources.md`, checked against freely accessible primary text. Cross-references go to `Docs/v1.3/construct-decisions.md` (revision 1). The sealed folder was not read.

**What was read in full:**
- Martin's blog post "The Clean Architecture" (2012).
- Cockburn's "Hexagonal Architecture" (HaT Technical Report 2005.02, v0.9, dated 2005-09-04), at alistair.cockburn.us.
- Evans, *DDD Reference* (2015, CC-BY, 59 pp.).
- Vernon, "Effective Aggregate Design", parts I to III (2011, dddcommunity.org).
- The NestJS docs source (`modules.md`, `components.md` = "Providers", `data/typeorm.md`).
- Fowler's bliki entry "PresentationDomainDataLayering" (2015) and the PoEAA catalogue entry "Active Record".

**Not freely accessible:** the books by Martin (2017), Fowler (2002), POSA 1 (1996), Evans (2003) and Vernon (2013). O'Reilly previews returned 403. For these, the statuses rest on four things: the accessible companion text (blog, Reference, bliki), publisher tables of contents, reader highlights, and wording recalled from the books. Any wording marked *(recalled)* must be checked in print before it is quoted in the thesis.

**Status key:**
- **VERIFIED-VERBATIM**: an accessible text says it in close to the row's words.
- **VERIFIED-PARAPHRASE**: the source says it, but no accessible verbatim text was found.
- **PARTIALLY SUPPORTED**: part of the row is not in the source, or the source is weaker or different.
- **NOT FOUND / CONTRADICTED**: the source does not say it, or says the opposite.

## Summary table

| # | Style / rule | Status | Chapter ref | Main nuance | CD questions |
|---|---|---|---|---|---|
| 1 | Clean, dependency direction (FF-S01) | VERIFIED-VERBATIM (blog 2012). Book ch. 22 matches per a reader highlight. | ch. 22 correct | Martin forbids *mentioning a name*, which supports counting type-only imports. The rule says nothing against skipping a ring inward. | Q2, Q11, Q20, Q24 |
| 2 | Clean, domain purity (FF-P01) | VERIFIED-VERBATIM (blog "Independent of Frameworks / UI / Database"). Ch. 32 is VERIFIED-PARAPHRASE. | ch. 22, 32 correct. Add ch. 30, 31. | Ch. 32 accepts "marrying" some frameworks, such as the standard library *(recalled)*. The rule covers direct knowledge; transitive dependencies are not addressed. | Q10, Q20 |
| 3 | Clean, repository/gateway placement (FF-P03) | PARTIALLY SUPPORTED. DIP at the boundary is verbatim in the blog. Gateway placement is not in ch. 22. | **Incomplete.** Gateway interfaces are in ch. 23 "Database Gateways" (p. 214). Also ch. 17. | Ch. 11 DIP also covers *consumers* ("don't refer to volatile concrete classes", recalled), which weakens Q7's statement that the sources speak only of implementers. | Q7, Q9 |
| 4 | Clean/Layered, acyclic dependencies (FF-S02) | VERIFIED-VERBATIM ("Allow no cycles in the component dependency graph", ch. 14, p. 112, from preview and TOC) | ch. 14 correct | ADP is over **components**, which ch. 12 defines as units of deployment. It is not stated over files, layers or styles. Q3 cites "ch. 13 and 14"; ch. 13 is cohesion. | Q3, Q4, Q16 |
| 5 | Layered, downward-only, no skipping when strict (FF-S01, FF-S03) | PARTIALLY SUPPORTED. The downward rule is Fowler's (VERIFIED-PARAPHRASE). The no-skip rule is POSA's strict form; Fowler hedges it. | **POSA locator missing** (ch. 2, §2.2 "From Mud to Structure", Layers, about pp. 31–51, verify) | Fowler: layering is "mostly opaque" *(recalled)*, and the domain depends on the data source (bliki, verbatim). POSA names a Relaxed Layered System variant and upward notification. | Q10, Q12 |
| 6 | Hexagonal, core isolation (FF-S04 et al.) | PARTIALLY SUPPORTED. "Communicates over ports" and "blissfully ignorant" are verbatim. No dependency rule is stated, and the term "application core" does not occur. | No section given. Use "Intent", "Nature of the Solution". | Cockburn does not split the hexagon. His own sample application imports `repository.RepositoryFactory`. The **"application core" quote in Q6 is not Cockburn's wording.** | Q5, Q6, Q11 |
| 7 | Hexagonal, port-adapter | VERIFIED-VERBATIM for ports and adapters converting. PARTIALLY SUPPORTED for "driven adapters implement ports the core defines". | No section given. Use "Nature of the Solution", "Sample Code", "Application Notes". | In the sample code, the **primary FIT adapter calls the secondary adapter's factory** (adapter-to-adapter wiring). Cockburn never states "adapters do not talk to each other". | Q5, Q7 |
| 8 | DDD, aggregate boundary | VERIFIED-VERBATIM (DDD Reference p. 16). Vernon: VERIFIED-PARAPHRASE. | Evans ch. 6, Vernon ch. 10 correct | Evans explicitly allows **transient** references to inner members, so the rule is stricter than Evans. Vernon's rule is about references *between* aggregates (by identity), and he lists reasons to break it. | Q19 |
| 9 | DDD, repository only for aggregate roots | VERIFIED-VERBATIM (Reference p. 17) | Evans ch. 6, Vernon ch. 12 correct | Evans adds "that actually need direct access", so a root without a repository is fine. | (none directly) |
| 10 | DDD, value-object immutability | VERIFIED-VERBATIM ("Treat the value object as immutable", Reference p. 12). "Replace it rather than modify it" is Vernon (Replaceability), VERIFIED-PARAPHRASE. | Evans ch. 5, Vernon ch. 6 correct | Evans 2003 has a "when to allow mutability" special case for performance, if the value is not shared *(recalled)*. | Q14 |
| 11 | DDD, isolated domain (framework-free) | VERIFIED-VERBATIM in the **2015 Reference** (p. 10). PARTIALLY SUPPORTED for the **2003** ch. 4 alone. | ch. 4 correct, but add DDD Reference 2015 p. 10 | In 2003, Evans's domain "depends only on the layers below", and infrastructure is below. "Eliminate any dependency on infrastructure" is the 2015 wording. The domain sits below application, which supports Q11 A. | Q10, Q11, Q20 |
| 12 | DDD, bounded-context isolation | PARTIALLY SUPPORTED. BC and explicit translation are verbatim. The "published interface or ACL" pair is narrower than Evans. | Evans ch. 14, Vernon ch. 2–3 correct. Add Vernon ch. 13. | Evans also sanctions Shared Kernel, Conformist and Customer/Supplier. **The ACL "talks to the other system through its existing interface"**, which argues against the sealed ACL exemption in Q18. | Q15, Q17, Q18 |
| 13 | NestJS, module boundaries and DI | VERIFIED-VERBATIM ("Modules" page) | "Modules", "Providers" correct | The constraint is about **DI injection**, not file imports. `@Global()` removes the `imports` requirement, and re-exporting is allowed. The docs are silent on layer order, and their TypeORM example injects a repository into a service. | Q13 |

**Wrong or incomplete chapter references (item 2):**
- Row 3 (FF-P03) cites ch. 22 and ch. 11. The gateway-placement text is ch. 23 "Presenters and Humble Objects", section "Database Gateways" (p. 214, publisher TOC). Ch. 17 "Boundaries: Drawing Lines" has the `DatabaseInterface`-in-business-rules example *(recalled)*. Add both.
- Construct-decisions Q3 cites "Martin 2017, ch. 13 and 14, ADP". ADP is ch. 14. Ch. 13 is "Component Cohesion" (REP/CCP/CRP). The definition of a component is in ch. 12 "Components". Change it to "ch. 12 and 14".
- Row 5 gives no locator for POSA. Give ch. 2 "Architectural Patterns", §2.2 "From Mud to Structure", "Layers" (about pp. 31–51; check against the book).
- Row 11 cites only Evans 2003 ch. 4. The "framework-free" reading needs the 2015 *DDD Reference*, p. 10 (see row 11).
- Rows 6 and 7 cite Cockburn 2005 with no section. The article has named sections; use them (see rows 6 and 7).
- No other chapter number looks wrong. These all match the published tables of contents:
  - Martin: ch. 11 DIP, ch. 14 Component Coupling, ch. 22 The Clean Architecture, ch. 32 Frameworks Are Details.
  - Fowler: ch. 1 Layering.
  - Evans: ch. 4 Isolating the Domain, ch. 5 A Model Expressed in Software, ch. 6 The Life Cycle of a Domain Object, ch. 14 Maintaining Model Integrity.
  - Vernon: ch. 2 Domains, Subdomains and Bounded Contexts, ch. 3 Context Maps, ch. 6 Value Objects, ch. 10 Aggregates, ch. 12 Repositories.

**Rules with no source row:** FF-P02, FF-P04, FF-P05, FF-P06, FF-DT05, FF-DS01, FF-DS02 and FF-S04 in DDD appear in construct-decisions but have no row of their own in the sources table. If any of them blocks, it needs a row (see Q1, Q15, Q21).

---

## Row-by-row detail

### 1. Clean, dependency direction (FF-S01). VERIFIED-VERBATIM

- **Quote:** "This rule says that source code dependencies can only point inwards. Nothing in an inner circle can know anything at all about something in an outer circle." (Martin 2012, blog, section "The Dependency Rule", https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- **Book:** ch. 22, "The Dependency Rule". The book wording, "source code dependencies must point only inward, toward higher-level policies", appears in a Goodreads reader highlight. Confirm the page in print.
- **Nuances:**
  - **Q2 (type-only imports):** the blog is explicit: "the name of something declared in an outer circle must not be mentioned by the code in the an inner circle. That includes, functions, classes. variables, or any other named software entity." (same section; the typos are Martin's). An `import type` mentions a name, so this is direct support for Q2 A, stronger than the "source-code dependency" argument Q2 now uses.
  - **Q24 (inward bypass):** "the circles are schematic … However, The Dependency Rule always applies." (section "Only Four Circles?"). Martin constrains direction only; nothing forbids an outer ring from using an inner ring two steps in. This supports Q24 A.
  - **Q20 (transitive):** Martin speaks of what inner code *knows*. He is silent on transitive dependencies. He does forbid passing framework-generated data formats inward ("data formats used in an outer circle should not be used by an inner circle", same section). That concerns data shape, not transitive imports.

### 2. Clean, domain purity (FF-P01). VERIFIED-VERBATIM (blog); ch. 32 VERIFIED-PARAPHRASE

- **Quote:** "Independent of Frameworks. The architecture does not depend on the existence of some library of feature laden software." (Martin 2012, blog, opening list)
- **Quote:** "Independent of Database. … Your business rules are not bound to the database." (same list)
- **Ch. 32:** "Frameworks Are Details". Its gist is "don't marry the framework". This was not checked verbatim; the book was not accessible.
- **Locator:** add ch. 30 "The Database Is a Detail" and ch. 31 "The Web Is a Detail" for the database and UI parts of the row.
- **Nuances:**
  - Ch. 32 is not absolute. Martin accepts that some frameworks must be "married", the language's standard library being the example. He also allows a DI framework at the edge, but not its annotations scattered through business objects *(recalled; verify)*. If the thesis states FF-P01 as "no framework at all", it should say that the tool is stricter than ch. 32, or give the list of allowed packages.
  - **Q10:** Martin's purity rule belongs to *Clean*. Nothing in Martin carries it over to Layered, which is consistent with P1 and Q10 C.

### 3. Clean, repository/gateway placement (FF-P03). PARTIALLY SUPPORTED

- **Quote (DIP across boundaries):** "So we have the use case call an interface (Shown here as Use Case Output Port) in the inner circle, and have the presenter in the outer circle implement it." (blog, "Crossing boundaries"). "The same technique is used to cross all the boundaries" (same paragraph).
- **Quote (no DB knowledge inward):** "No code inward of this circle should know anything at all about the database." (blog, "Interface Adapters")
- **Gateway placement:**
  - Explicit in **ch. 23**, section "Database Gateways", p. 214 (publisher TOC). Martin describes gateways as polymorphic interfaces for the CRUD operations, implemented by classes in the database layer *(recalled; secondary summaries agree)*.
  - Ch. 17 has the `DatabaseInterface` / `DatabaseAccess` boundary figure *(recalled)*.
  - Ch. 22 alone does not place the gateway interface. **Add ch. 23 (and ch. 17).**
- **Nuances:**
  - **Q7:** Q7's literature line says both sources "describe the *implementer*. They are silent on consumers." That holds for ch. 22/23 and for Cockburn. It does not hold for **ch. 11 (DIP)**, which this same row cites. DIP's coding rules are addressed to the *user* of a class, for example "Don't refer to volatile concrete classes. Refer to abstract interfaces instead." *(recalled; check ch. 11)*. So a consumer that names a concrete adapter breaks DIP. Under P2 that belongs to FF-P02 (the DIP rule), not FF-P03, which still supports Q7 A. But the literature line should say "the placement texts are silent on consumers; DIP covers them and is owned by FF-P02".
  - **Q9:** Martin's DIP is stated for languages with explicit interfaces. He says nothing about structural typing, so a missing `implements` has no source ruling.

### 4. Clean/Layered, acyclic dependencies (FF-S02). VERIFIED-VERBATIM

- **Quote:** "Allow no cycles in the component dependency graph." (Martin 2017, ch. 14 "Component Coupling", "The Acyclic Dependencies Principle", p. 112). Confirmed through the O'Reilly preview snippet and the Pearson TOC. The page number comes from the TOC.
- **Nuances:**
  - **Q3 (unit of ADP):** Martin defines components in **ch. 12** as units of deployment, such as jar files or DLLs *(recalled; ch. 12 opening)*. The ch. 14 discussion (the "morning-after syndrome", release numbers) is about release units. This backs Q3's "a file is not a component". **Fix Q3's citation from "ch. 13 and 14" to "ch. 12 and 14".** Ch. 13 (Component Cohesion) is about what goes *into* a component.
  - **Q4:** Martin says nothing about layers as ADP components. In ch. 14, the remedy for a cycle is DIP or a new component, which is about release units, not layers. This is consistent with Q4 A.
  - **Q16:** ADP is stated for components of any system, not for a style. This supports Q16's reasoning. With Q3 C, the DDD cycle in v09 crosses application and domain, so it is a component-level cycle only if DDD's layers or contexts are taken as the components. State that mapping.
  - The row label "Clean, Layered" is a choice the thesis makes. Martin presents ADP in Part IV, "Component Principles", before and apart from the Clean Architecture.

### 5. Layered, downward-only, no skipping when strict (FF-S01, FF-S03). PARTIALLY SUPPORTED

- **Fowler (PoEAA ch. 1 "Layering", p. 17 onward):**
  - *(Recalled; a web search confirmed the sentence is in ch. 1, but the page was not readable)*: "the higher layer uses various services defined by the lower layer, but the lower layer is unaware of the higher layer."
  - The same passage goes on to say that each layer usually hides its lower layers. Fowler adds that most layering schemes are opaque, "or rather most are mostly opaque" *(recalled)*.
  - Status: VERIFIED-PARAPHRASE for "lower layers do not use upper ones".
- **Fowler, accessible:** "presentation depends on the domain, which then depends on the data source." (bliki "PresentationDomainDataLayering", 2015, https://martinfowler.com/bliki/PresentationDomainDataLayering.html)
- **POSA 1 (Buschmann et al. 1996, ch. 2 §2.2 "Layers"):**
  - The strict structure is that the services of Layer J are used only by Layer J+1. That rules out skipping.
  - The pattern also names a **"Relaxed Layered System"** variant, in which a layer may use any lower layer. Secondary sources (OpenUP [BUS96], course slides) confirm this.
  - Status: VERIFIED-PARAPHRASE. No accessible verbatim text was found.
- **Assessment:** "Lower layers do not use upper ones" is supported by both sources. "Strict layering forbids skipping" is supported by POSA's strict form, but only as a *variant choice*: POSA itself offers the relaxed form, and Fowler describes most real systems as "mostly opaque". Cite POSA for the strict clause, not Fowler, and present strictness as a declared option of the spec, not as the style's definition.
- **Nuances:**
  - **Q10:** Fowler's own layering puts the domain *above* the data source. Domain → data source is allowed (bliki, quoted above), and Active Record "wraps a row in a database table … and adds domain logic on that data" (PoEAA catalogue, https://martinfowler.com/eaaCatalog/activeRecord.html). This backs Q10's claim that layered has no purity rule. PoEAA ch. 1 also says the domain and data source "should never be dependent on the presentation" *(recalled; verify p.)*. That is the direction clause that covers the `express` case in Q10 C.
  - **Q12:** POSA's "Layers" pattern routes notifications upward through callbacks; a secondary summary puts it as "requests go down, notifications go back up" (patterns.univ-nantes.io). Upward *use* is still forbidden, and a skip is not the same thing as an upward edge. The strict rule is one sentence in POSA ("only used by Layer J+1"), so splitting it into two clauses (FF-S01 and FF-S03) is a modelling choice. That supports Q12 B but should be stated as a choice.

### 6. Hexagonal, core isolation (FF-S04, dependency-direction-graph, core-isolation). PARTIALLY SUPPORTED

- **Quotes** (Cockburn 2005, https://alistair.cockburn.us/hexagonal-architecture/):
  - "The application is blissfully ignorant of the nature of the input device." (section "Intent")
  - "the application communicates over ports to external agencies." (section "Nature of the Solution")
- **What is missing:**
  1. Cockburn states no source-dependency rule. His one explicit rule is about *logic* leaking: "The rule to obey is that code pertaining to the inside part should not leak into the outside part." ("Nature of the Solution")
  2. The term **"application core" does not occur in the article** (zero hits for "core"). Cockburn says "the application", "the inside" and "the inner hexagon".
  3. His sample `Discounter` application imports `repository.RepositoryFactory` as well as the `RateRepository` interface ("Sample Code", Stage 3). So the original sample does not keep strict source-level isolation from the adapter side.
- **Nuances:**
  - **Q6:** Q6's literature line quotes the source as "The *application core* … does not depend on adapters". That is the paraphrase in the sources table, not Cockburn's wording; fix the quotation marks. The substance still favours Q6 B: Cockburn's hexagon is the whole application, with no inner split.
  - **Q11:** Cockburn is silent on the inside of the hexagon, as Q11 says. Confirmed.
  - **Q5:** see row 7.

### 7. Hexagonal, port-adapter. VERIFIED-VERBATIM (first two clauses); PARTIALLY SUPPORTED (third)

- **Quotes** (Cockburn 2005):
  - "As events arrive from the outside world at a port, a technology-specific adapter converts it into a usable procedure call or message and passes it to the application." ("Intent")
  - "For each external device there is an adapter that converts the API definition to the signals needed by that device and vice versa." ("Nature of the Solution")
  - Driving and driven: ports and adapters come in two flavours, which "could be also called driving adapters and driven adapters." ("Application Notes: The Left-Right Asymmetry")
- **"Secondary adapters implement ports the core defines":**
  - In the sample, `MockRateRepository implements RateRepository`, and the application holds a `RateRepository`. Implementation is therefore shown.
  - *Ownership* is not shown: the interface sits in a package `repository`, not in the application, and the article never says who defines a port.
  - The "core owns the port" reading is later DIP framing (Martin, Vernon ch. 4). Cite it as such.
- **Nuance, Q5 (adapter → adapter):**
  - Cockburn never writes that adapters do not talk to each other. In his own sample, the primary adapter `TestDiscounter` (a FIT fixture) constructs the application with `RepositoryFactory.getMockRateRepository()`. That is a primary adapter directly referencing the secondary adapter side ("Sample Code", Stage 3).
  - Q5's literature line ("each actor talks to the application through a port, so adapters do not talk to each other. This is a defining constraint.") is therefore an **inference**, and Cockburn's example has a configuration-time adapter-to-adapter edge.
  - If Q5 D is adopted, the new rule should exempt wiring or composition code (Cockburn's later "configurator" idea), or the thesis should say the rule is stricter than the 2005 sample.

### 8. DDD, aggregate boundary. VERIFIED-VERBATIM (Evans); VERIFIED-PARAPHRASE (Vernon)

- **Quote:** "allow external objects to hold references to the root only (references to internal members passed out for use within a single operation only)." (Evans, *DDD Reference* 2015, "Aggregates", p. 16)
- **Book:** Evans 2003, ch. 6 "Aggregates". The book's rule list has the same content: the root may hand out references to inner entities, but only for transient use *(recalled; about p. 128)*.
- **Vernon:**
  - IDDD ch. 10 gives four rules: "Model True Invariants in Consistency Boundaries", "Design Small Aggregates", "Reference Other Aggregates by Identity", "Use Eventual Consistency Outside the Boundary". The accessible form is "Effective Aggregate Design" part III, which lists the four rules.
  - Vernon restates Evans: "[DDD] states that one aggregate may hold references to the root of other aggregates." (part II, "Rule: Reference Other Aggregates By Identity")
- **Nuances:**
  - **Q19:** confirmed. The Reference allows transient references in so many words, so the "stricter than Evans" label in Q19 A is correct and should cite p. 16.
  - Vernon's ch. 10 rule concerns references **between aggregates**, not to inner entities, and Vernon gives explicit "reasons to break the rules" (part II/III). Cite Vernon for the root-only rule only as a restatement of Evans.

### 9. DDD, repository only for aggregate roots. VERIFIED-VERBATIM

- **Quote:** "Provide repositories only for aggregate roots that actually need direct access." (DDD Reference, "Repositories", p. 17)
- **Book:** Evans 2003, ch. 6 "Repositories", same wording in the book *(recalled)*.
- **Vernon:** IDDD ch. 12. He gives a roughly one-to-one mapping of aggregate type to repository *(recalled)*. VERIFIED-PARAPHRASE.
- **Nuance:** the rule is one-directional. A repository for a non-root breaks it, but a root without a repository is fine, because Evans covers only roots "that actually need direct access". The Reference also warns that queries can "instantiate a few specific objects from the interior of an aggregate, blindsiding the aggregate root" (p. 17), which is the reason for the rule.

### 10. DDD, value-object immutability. VERIFIED-VERBATIM (Evans); VERIFIED-PARAPHRASE (Vernon)

- **Quote:** "Treat the value object as immutable. Make all operations Side-effect-free Functions that don't depend on any mutable state." (DDD Reference, "Value Objects", p. 12)
- **"Replace it rather than modify it":** this is Vernon's "Replaceability" characteristic (IDDD ch. 6, alongside "Immutable" and "Value Equality") *(recalled)*. It is not in the Evans Reference.
- **Nuance, Q14:**
  - Evans 2003 ch. 5 has a special case for allowing mutability: performance, frequently changing values, expensive creation, provided the value is not shared *(recalled; verify)*.
  - So immutability is the default in Evans, not an absolute. This bears on whether FF-DT03 is "defining" (Q14's premise).
  - The Reference p. 12 states it without that exception, so cite p. 12 for the blocking reading, and note the 2003 exception in the threats-to-validity section.

### 11. DDD, isolated domain (framework-free). VERIFIED-VERBATIM (2015 Reference); PARTIALLY SUPPORTED (2003 ch. 4 alone)

- **Quote:** "Isolate the expression of the domain model and the business logic, and eliminate any dependency on infrastructure, user interface, or even application logic that is not business logic." (DDD Reference, "Layered Architecture", p. 10)
- **Quote:** "Develop a design within each layer that is cohesive and that depends only on the layers below." (same pattern, p. 10)
- **Nuances:**
  - **Edition matters.** In the 2003 book (ch. 4, Layered Architecture), the layer order is UI, Application, Domain, Infrastructure. The domain may depend on the layers below, so on Infrastructure. The book asks only that domain code be "isolated" from the other code *(recalled)*.
  - The "eliminate any dependency on infrastructure" clause, and the remark that Hexagonal "may serve as well or better" (p. 10), are the 2015 Reference wording.
  - So "framework-free" is supported by Evans 2015, not by Evans 2003 ch. 4 alone. **Add "Evans 2015, *DDD Reference*, p. 10" to the row.**
  - **Q11:** both editions put the domain below Application, and the 2015 text says the domain has no dependency on "application logic that is not business logic". This supports Q11 A.
  - **Q10:** Evans's own Layered Architecture keeps infrastructure below the domain (2003). This is a second source, beside Fowler, showing that layered allows domain → persistence. It supports Q10 C.
  - **Q20:** silent on transitive dependencies.

### 12. DDD, bounded-context isolation. PARTIALLY SUPPORTED

- **Quote:** "Explicitly define the context within which a model applies." (DDD Reference, "Bounded Context", p. 2)
- **Quote (Context Map):** "Describe the points of contact between the models, outlining explicit translation for any communication, highlighting any sharing, isolation mechanisms, and levels of influence." (p. 29)
- **Quote (ACL):** "This layer talks to the other system through its existing interface, requiring little or no modification to the other system." (p. 34)
- **Published interface:** this corresponds to Open-host Service: "Define a protocol that gives access to your subsystem as a set of services." (p. 35)
- **Why only partial:**
  - Evans requires integration to be *explicit*, but he sanctions more relationships than "published interface or ACL".
  - Shared Kernel (p. 31) shares code.
  - Conformist (p. 33) adopts the upstream model with no translation: "slavishly adhering to the model of the upstream team".
  - Partnership (p. 30) and Customer/Supplier (p. 32) are also legitimate.
  - The rule as written forbids Conformist-style direct use, so it is stricter than Evans. That is acceptable if declared.
- **Nuances:**
  - **Q15:** Shared Kernel: "Designate with an explicit boundary some subset of the domain model that the teams agree to share." (p. 31). Q15's reading is confirmed: a shared helper that is not designated has no sanction.
  - **Q17:** Open-host Service is "a protocol … as a set of services". A barrel that re-exports an internal application service is a declared surface, but whether it is a "protocol" is not settled. Evans is silent on module re-exports, as Q17 says.
  - **Q18: the source argues against the sealed exemption.** The ACL talks to the other system "through its existing interface" (p. 34). It translates; it does not reach inside. Q18 A (keep the sealed exemption) can still be right on procedure, but the thesis must say that the exemption is **broader than Evans**. Q18's literature line already notes this. This report confirms it verbatim.
- **Vernon:** ch. 2–3 are correct for Bounded Context and Context Map. Add **ch. 13 "Integrating Bounded Contexts"** for the integration clause.

### 13. NestJS, module boundaries and DI. VERIFIED-VERBATIM

- **Quote:** "A module **encapsulates** its providers by default: you can inject only providers that are part of the current module or that are explicitly exported by an imported module. A module's exported providers form its public interface, or API." (NestJS docs, "Modules", https://docs.nestjs.com/modules; source `content/modules.md`, read 2026-10-15)
- **Older wording:** older versions of the docs read "it's impossible to inject providers that are neither directly part of the current module nor exported from the imported modules." Cite the page with an access date, since the docs are edited.
- **Nuances:**
  - The guarantee is about **DI injection** resolved by the Nest injector. The docs say nothing about TypeScript `import` statements between files of different modules. If the preset checks import edges, it is stricter than the docs, so say so.
  - `@Global()` makes a module's exported providers injectable without listing the module in `imports`. The docs call this "not a recommended design practice" ("Global modules"). Module re-exporting is allowed ("Module re-exporting").
  - **Q13:** the docs are **silent on layer order**. Two passages bear on it. "Providers": "Controllers should handle HTTP requests and delegate more complex tasks to **providers**." "Providers": "services, repositories, factories, and helpers, can be treated as providers."
  - The "TypeORM" recipe ("Repository pattern") injects the `User` repository into `UsersService` with `@InjectRepository()` (`content/data/typeorm.md`). So the docs' own example has a service using a repository directly. This supports Q13's yes options and the preset's "Controller → Service → Repository" reading. It does not support ADR-V13-02's "Clean Architecture inside Nest modules".

---

## Cross-reference: nuances by construct-decisions question

| Q | What the sources add | Effect on the recommendation |
|---|---|---|
| Q2 | Martin 2012: the inner circle must not *mention the name* of anything in an outer circle, including classes. | Stronger support for A. Cite the blog sentence. |
| Q3 | ADP is over components (ch. 12: units of deployment), stated in ch. 14. Ch. 13 is not ADP. | Supports C's proxy argument. **Fix the citation to ch. 12 and 14.** |
| Q4 | Martin does not treat layers as ADP components. | Consistent with A. |
| Q5 | Cockburn never states adapter isolation. His sample's primary adapter wires a secondary adapter. | D's "defining constraint" is an inference. Exempt composition code, or label the rule stricter than Cockburn. |
| Q6 | "Application core" is not Cockburn's phrase. The hexagon is the whole application, not split. | Substance still favours B. **Fix the quotation.** |
| Q7 | Ch. 11 DIP covers consumers; the placement texts (ch. 22/23, Cockburn) do not. | A stands under P2 (FF-P02 owns DIP). Reword "sources are silent on consumers". |
| Q10 | Fowler (bliki): domain depends on data source. Active Record. Evans 2003: infrastructure below domain. Fowler ch. 1: domain never depends on presentation *(recalled)*. | Supports C; the upward `express` case is a direction fact. |
| Q11 | Evans (both editions): domain below application. Cockburn silent. | Supports A. |
| Q12 | POSA's strict rule is one sentence (J+1 only), and POSA allows upward callbacks. | B is a defensible modelling split; state it as such. |
| Q13 | NestJS docs silent on layers. Their TypeORM example injects a repository into a service. | Supports the yes options; contradicts ADR-V13-02's wording. |
| Q14 | Evans Reference p. 12: immutable without exception. Evans 2003 ch. 5 allows mutability as a performance special case *(recalled)*. | A is defensible on p. 12. Note the 2003 exception as a validity threat. |
| Q15 | Shared Kernel must be explicitly designated (p. 31). | Confirms the construct reading behind A (defer). |
| Q16 | ADP is style-independent (Part IV of Martin). | Supports B; state which units count as components in DDD. |
| Q17 | Open-host Service is "a protocol … as a set of services"; nothing on re-exports. | Silent, as stated. |
| Q18 | ACL "talks to the other system through its existing interface" (p. 34). | The source favours B. A survives only on sealed-procedure grounds; label the exemption broader than Evans. |
| Q19 | Reference p. 16: transient references allowed verbatim. | Confirms "stricter than Evans"; cite p. 16. |
| Q20 | Martin, Evans: silent on transitive dependencies. | Consistent with A. |
| Q24 | Martin: the circles are schematic; only direction is constrained. | Supports A. |

## Before thesis use: what to check in print

1. Martin 2017:
   - ch. 22, the Dependency Rule sentence and page;
   - ch. 23, p. 214, the gateway wording;
   - ch. 17, the boundary figure;
   - ch. 11, the DIP consumer rules;
   - ch. 12, the definition of a component;
   - ch. 32, the "marry" passage.
2. Fowler 2002, ch. 1: the "unaware of the higher layer" sentence, "mostly opaque", and the "never dependent on the presentation" rule, with page numbers.
3. POSA 1, Layers: the exact strict-structure sentence, the Relaxed Layered System variant, and the callback or notification passage, with pages.
4. Evans 2003:
   - ch. 4: the layer order and the "depends only on the layers below" sentence;
   - ch. 5: the mutability special case;
   - ch. 6: the aggregate rule list, page about 128.
5. Vernon 2013: ch. 6 (Replaceability), ch. 10 (the four rules), ch. 12 (one repository per aggregate type), ch. 13.

## Sources consulted

- Martin, R. C. (2012). [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html).
- Cockburn, A. (2005). [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/).
- Evans, E. (2015). [Domain-Driven Design Reference](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf).
- Vernon, V. (2011). Effective Aggregate Design, [part I](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_1.pdf), [part II](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_2.pdf), [part III](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_3.pdf).
- Fowler, M. (2015). [PresentationDomainDataLayering](https://martinfowler.com/bliki/PresentationDomainDataLayering.html).
- Fowler, M. [Active Record](https://martinfowler.com/eaaCatalog/activeRecord.html) (PoEAA catalogue).
- NestJS docs: [Modules](https://docs.nestjs.com/modules), [Providers](https://docs.nestjs.com/providers), [TypeORM](https://docs.nestjs.com/techniques/database). Source files at github.com/nestjs/docs.nestjs.com.
- Secondary, used only for locators:
  - [O'Reilly, Clean Architecture ch. 14](https://www.oreilly.com/library/view/clean-architecture-a/9780134494272/ch14.xhtml) (ADP wording, from the search snippet);
  - [Pearson TOC](https://www.pearson.com/store/en-us/p/clean-architecture-a-craftsman-s-guide-to-software-structure-and-design/P200000009528/9780134494166) (p. 112 ADP, p. 214 Database Gateways);
  - [Goodreads highlights](https://www.goodreads.com/notes/36239393-clean-architecture/6591213-mark-lennox?page=3) (ch. 22 wording);
  - [O'Reilly, PoEAA ch. 1](https://oreilly.com/library/view/patterns-of-enterprise/0321127420/ch01.xhtml) (sentence location only);
  - [OpenUP layering guideline](https://www.utm.mx/~caff/doc/OpenUPWeb/openup/guidances/guidelines/layering_F169CF07.html) (POSA Relaxed Layered);
  - [patterns.univ-nantes.io/layers](https://patterns.univ-nantes.io/layers.html) (POSA notifications go up).
