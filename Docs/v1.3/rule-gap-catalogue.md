# v1.3 Rule-gap catalogue

**2026-10-16.** This document looks for architectural constraints that each style's primary sources state but that no DaedalusArch rule checks. It adds the eight most valuable of the statically checkable ones as an **opt-in, advisory** extension catalogue. Results are on **development data only**: the 71 dev reference variants. The E1 run could not be done (see §5). Nothing here is scored, tuned or sealed.

- Code: `src/fitness-compiler/rule-gap-templates.ts` holds the Cypher, the a priori tiers and the source rows. `src/fitness-compiler/rule-gap-in-memory.ts` holds the mirrors and `ruleGapParams`.
- Opt-in mechanism: `V13_OPT_IN_EXTENSION_CATALOGUES` and `v13OptInCatalogueOf` in `src/fitness-compiler/extension-templates.ts`.
- Fixtures: `tests/fixtures/v1.3-rule-gaps/`.
- Unit tests: `tests/unit/fitness-compiler/rule-gap-templates.test.ts`.
- Live run: `scripts/v1.3/rule-gaps-run.ts`, on `--engine cypher-interp` (the default) or `--engine neo4j`. Raw output is in `results/v1.3-rule-gaps/`.
- No existing template, tier, preset or the sealed `Docs/v1.3/rule-tiers.md` was changed.

## 1. Method and sources

**Starting point.** The verified locators and the nuances come from `Docs/v1.3/rule-source-verification.md` and `Docs/v1.3/style-rule-sources-errata.md`.

**Read again in full on 2026-10-16** for the new rows:
- Martin's 2012 blog post "The Clean Architecture";
- the NestJS docs source `content/modules.md`;
- Evans, *DDD Reference* (2015), PDF extracted with `pdftotext`;
- Vernon, "Effective Aggregate Design" part II (2011), PDF extracted with `pdftotext`.

**Not accessible:** the books (Martin 2017, Fowler 2002, POSA 1 1996, Evans 2003, Vernon 2013). Their locators come from the verification file and from tables of contents. Wording taken from them is marked **(recalled)** and must be checked in print before it is quoted.

**Classification of each constraint against the existing rules:**
- `covered`: a template checks the constraint as stated, or as a declared, stricter reading of it.
- `partially covered`: a template checks part of it, for example one layer, one side of a boundary, a name proxy, or only one edge kind.
- `not covered`: no template reads the constraint, and it can be checked statically from the APG or APG v2.
- `not checkable statically`: the constraint is about runtime behaviour, transactions, intent or the placement of logic. A graph fact cannot decide it.

The existing rules counted here:
- the frozen `cypher-templates.ts` (FF-S/P/C/SO/CV);
- `hexagonal-templates.ts`;
- `ddd-templates.ts` (FF-DS/DT);
- `v13-templates.ts`, the module-wiring example;
- `apg2-templates.ts`;
- `cheap2-templates.ts` (proxies that need cheap facts, which no unit persists yet).

The tiers are those of `Docs/v1.3/rule-tiers.md`.

## 2. Coverage matrix

### Clean Architecture (Martin 2012 blog; Martin 2017)

| # | Constraint | Source, locator | Existing rule(s) | Status |
|---|---|---|---|---|
| C1 | Source-code dependencies point only inward | blog "The Dependency Rule" (verbatim); book ch. 22 | FF-S01, FF-S04 | covered |
| C2 | The inner circle does not mention any name declared in an outer one, including through types | blog, same section (verbatim) | FF-S01 (type-only imports count), boundary-type-leak (APG v2, inferred types) | covered |
| C3 | Entities do not depend on frameworks, database or UI | blog opening list (verbatim); ch. 22, 30–32 | FF-P01 | covered |
| C4 | The use-case layer is not affected by the database, the UI or the frameworks | blog "Use Cases" (verbatim) | FF-P01 reads the domain layer only; io-outside-adapters (APG v2) reads I/O calls, not imports | partially covered → **G1** |
| C5 | No code inward of the interface adapters knows anything about the database | blog "Interface Adapters" (verbatim) | FF-P01 (domain), io-outside-adapters (db calls in domain and application) | partially covered (G1 adds the imports) |
| C6 | Simple data structures cross boundaries, not entities or database rows | blog "What data crosses the boundaries" (verbatim) | FF-P05 (controller side), boundary-type-leak (infrastructure types) | partially covered → **G3** (use-case side) |
| C7 | Boundaries are crossed by dependency inversion: the inner circle owns the port and the outer circle implements it | blog "Crossing boundaries" (verbatim); ch. 11, 17 | FF-P02 (ratio), FF-P03 (name-based, implementer side) | partially covered |
| C8 | Gateway interfaces sit in the use-case layer, and the database layer implements them | ch. 23 "Database Gateways", p. 214 (recalled) | FF-P03, port-adapter-pattern | partially covered |
| C9 | Controllers communicate with the use cases | blog "Crossing boundaries" (verbatim) | none (FF-S01 allows controller → repository port, since it points inward) | **not covered → G2** |
| C10 | No cycles in the component dependency graph (ADP) | ch. 14, p. 112 (verbatim, preview) | FF-S02, component-adp-cycle | covered |
| C11 | Depend in the direction of stability (SDP) | ch. 14 | component-sdp-violation, FF-C01/C03 | covered |
| C12 | Stable components are abstract (SAP, main sequence) | ch. 14 | FF-C06, component-main-sequence-distance | covered |
| C13 | Don't refer to volatile concrete classes | ch. 11 (recalled) | FF-P02, port-dependency-inversion (ratios) | partially covered |
| C14 | Don't derive from volatile concrete classes; don't override concrete functions | ch. 11 (recalled) | none | not covered: checkable (EXTENDS to a non-abstract class), not selected: low value, and dominated by framework base classes |
| C15 | Only Main knows the concrete classes; it creates and wires them | ch. 26 "The Main Component" (recalled) | composition-root scopes only; FF-P06 (domain `new`) | not covered: checkable (HOLDS_STATE_OF `initializer` / `constructor-new` to an infrastructure class outside the composition root), not selected (next batch) |
| C16 | Tests depend on the system; production code never depends on tests | ch. 28 "The Test Boundary" (recalled) | none | not covered: checkable (IMPORTS from a non-test to a test file), not selected (next batch) |
| C17 | CCP, CRP, REP (component cohesion) | ch. 13 | none | not checkable statically (reasons for change, release units) |
| C18 | Humble objects: presenters and views hold no logic | ch. 23 | none | not checkable statically |
| C19 | SRP, ISP | ch. 7, 10 | FF-SO01, FF-SO02 | partially covered (proxies) |
| C20 | Screaming architecture: the structure shows the use cases | ch. 21 | FF-N02 (judge) | not checkable statically |

### Layered (Fowler, PoEAA 2002, ch. 1; POSA 1 1996, Layers)

| # | Constraint | Source, locator | Existing rule(s) | Status |
|---|---|---|---|---|
| L1 | A higher layer uses services of the lower ones; the lower layer is unaware of the higher | Fowler ch. 1, p. 17 onward (recalled); bliki "PresentationDomainDataLayering" (verbatim) | FF-S01 | covered |
| L2 | Strict variant: layer J is used only by layer J+1 | POSA §2.2 "Layers", about pp. 31–51 (recalled) | FF-S03 (`layered` only) | covered |
| L3 | Domain and data source never depend on the presentation | Fowler ch. 1 (recalled) | FF-S01 | covered |
| L4 | Relaxed variant; notifications go upward through callbacks | POSA (secondary sources) | none needed | N/A (a permission, not a constraint) |
| L5 | Each layer offers a defined interface and hides its implementation (black-box layering) | POSA implementation steps (recalled) | deep-import-declared-api / deep-import-inferred-api (APG v2, components with an API) | partially covered |
| L6 | A service layer defines the application's boundary, and presentation goes through it | Fowler ch. 9 "Service Layer", p. 133 (recalled) | FF-S03 (file import, `layered`) | partially covered → **G2** (injection, any layer) |
| L7 | No domain logic in presentation or data source | Fowler ch. 1 | FF-N02 (judge) | not checkable statically |
| L8 | Services hold no conversational state (transaction scripts) | Fowler ch. 9 (recalled) | none | not covered → **G6** (shared with DDD) |

### Hexagonal (Cockburn 2005)

| # | Constraint | Source, locator | Existing rule(s) | Status |
|---|---|---|---|---|
| H1 | The application communicates with the outside only over ports | "Nature of the Solution" (verbatim) | core-isolation, dependency-direction-graph, io-outside-adapters | covered (as an inference: Cockburn states no source-dependency rule) |
| H2 | The application is ignorant of the input device | "Intent" (verbatim) | core-isolation, FF-P01 | covered |
| H3 | An adapter per external device converts between the port API and the device | "Intent", "Nature of the Solution" (verbatim) | port-adapter-pattern (outbound, name-based) | partially covered |
| H4 | Driven adapters implement the ports | "Sample Code" (shown, not stated) | port-adapter-pattern | covered |
| H5 | Adapters do not talk to each other | inference, not Cockburn's (verification row 7) | layer-skip-graph (imports) | covered (stricter than the source); G2 adds the injection |
| H6 | Inside code does not leak into the outside part | "Nature of the Solution" (verbatim) | none | not checkable statically (logic placement) |
| H7 | The application can be driven by tests and batch scripts as well as by users | "Intent" (verbatim) | untested-component (cheap2) | not checkable statically as stated |
| H8 | Primary adapters drive the application through a port | "Intent" | port-dependency-inversion (application side only) | partially covered; inbound adapter → concrete service not selected (the source is silent on interfaces) |

### DDD (Evans 2003; Evans, *DDD Reference* 2015; Vernon 2011/2013)

| # | Constraint | Source, locator | Existing rule(s) | Status |
|---|---|---|---|---|
| D1 | Isolate the domain: no dependency on infrastructure, UI or application logic | Reference p. 10 (verbatim) | FF-DT04 (domain-purity), dependency-direction-graph | covered |
| D2 | Outside objects hold references to the root only | Reference p. 16 (verbatim) | FF-DT01 | covered (stricter: transient references are allowed by Evans) |
| D3 | Repositories only for aggregate roots | Reference p. 17 (verbatim) | FF-DT02 | covered |
| D4 | Value objects are immutable, with side-effect-free functions | Reference p. 12 (verbatim) | FF-DT03 (member facts) | covered |
| D5 | Explicit bounded contexts; explicit translation between them | Reference pp. 2, 29, 34 (verbatim) | FF-DS01, FF-DS02 | covered (stricter than Evans) |
| D6 | A shared kernel is designated explicitly | Reference p. 31 (verbatim) | FF-DS01 (`outside_contexts`) | partially covered |
| D7 | Reference other aggregates by identity | Vernon, EAD II p. 7 (verbatim); IDDD ch. 10 | none (FF-DT01 reads inner entities only) | **not covered → G4** |
| D8 | Look dependent objects up before invoking the aggregate; no repository or service inside it | Vernon, EAD II p. 7 (verbatim); IDDD ch. 10 (recalled) | FF-P06 (domain → infrastructure only; a domain-layer repository port is not caught) | **not covered → G5** |
| D9 | Services are stateless | Evans 2003 ch. 5 "Services" (recalled). Not in the Reference p. 14, which was read. | none | **not covered → G6** |
| D10 | Modify one aggregate per transaction; eventual consistency outside the boundary | Vernon EAD I and II (verbatim headings) | none | not checkable statically (transactions are runtime) |
| D11 | Design small aggregates | Vernon EAD I | none | not checkable statically (judgement; a size metric would be a proxy) |
| D12 | Domain events live in the domain | Vernon ch. 8 | FF-DT05 | covered (advisory) |
| D13 | Application services are thin and hold no business rules | Evans ch. 4 | FF-DT06 (method-count proxy) | partially covered |
| D14 | Clients delegate all storage and access to repositories | Reference p. 17 (verbatim) | io-outside-adapters (db I/O in the core) | partially covered |
| D15 | Factories encapsulate complex creation | Reference p. 18 | none | not checkable statically |

### NestJS (docs.nestjs.com)

| # | Constraint | Source, locator | Existing rule(s) | Status |
|---|---|---|---|---|
| N1 | A module can inject only its own providers or providers exported by a module it imports | "Modules" (verbatim) | none (module-domain-imports-infrastructure reads layer kinds only) | **not covered → G7** |
| N2 | A shared provider is provided and exported once; registering it in several modules gives several instances | "Modules", "Shared modules" (verbatim) | none | **not covered → G8** |
| N3 | Making everything global is not recommended | "Modules", "Global modules" (verbatim) | none | not covered; not checkable from today's APG (Neo4j does not ingest decorators) |
| N4 | Controllers handle HTTP and delegate the complex work to providers | "Providers" (verbatim, verification row 13) | FF-P05 | partially covered → **G2** |
| N5 | Avoid circular module dependencies | "Circular dependency" (recalled) | FF-S02 (the TS import cycle that a module cycle needs) | covered |
| N6 | Layer order inside a module | docs are silent | presets | N/A (a preset choice, not a docs constraint) |

**Count:** 57 constraints.

| Status | Count | Notes |
|---|---|---|
| covered | 20 | |
| partially covered | 15 | |
| not covered | 11 | C9, L8, D7, D8, D9, N1 and N2 are closed by G2 and G4–G8. C14, C15 and C16 are checkable but not selected. N3 needs decorator ingestion. |
| not checkable statically | 9 | |
| N/A | 2 | |

G1 and G3 close partial gaps (C4/C5 and C6). G2 also covers parts of L6, H5 and N4. G6 covers both D9 and L8.

## 3. The new rules (catalogue `rule-gaps`)

**All eight rules are advisory, a priori.** The reasons are in `RULE_GAP_TEMPLATE_TIERS`.

**The catalogue is off by default.**
- It is not in `V13_EXTENSION_TEMPLATE_CATALOGUES`, so the default v1.3 spec validation rejects these names.
- No compile path, preset or score reads it.
- A caller enables it by name: `v13OptInCatalogueOf(name, ['rule-gaps'])`.

**Scope.** Each rule excludes test code. The class- and file-level rules also exclude composition roots, by layer and by file name, with the same patterns as the APG v2 scope ADR.

**Graph.** The rules need the v1.3 defaults: member facts and module wiring. G3 also needs APG v2 `SIGNATURE_USES`. G2, G4 and G5 also read `HOLDS_STATE_OF` (`fieldState`). On a graph without those edges, those rules or their field halves return no rows.

| Id | Template | Style | Checks | Graph facts | Source row (locator; wording) |
|---|---|---|---|---|---|
| G1 | `use-case-framework-free` | clean, hexagonal | An application-layer file imports a package on the spec's FF-P01 forbidden list | IMPORTS/RE_EXPORTS → Package | Martin 2012, "Use Cases"; verbatim |
| G2 | `controller-bypasses-application` | clean, nestjs, layered, hexagonal | A class named `*Controller`, outside the domain and application layers, injects or holds a type named `*Repository/Repo/Gateway/Dao/DataSource/Database/EntityManager` | CONSTRUCTOR_INJECTS, HOLDS_STATE_OF | Martin 2012, "Crossing boundaries" (verbatim); NestJS "Providers" (verbatim); Fowler ch. 9 (recalled) |
| G3 | `use-case-exposes-entity` | clean | A public method of an application-layer class takes or returns a domain-layer class in an entity folder, or named `*Entity/*Aggregate`, or a declared DDD root or inner entity | SIGNATURE_USES (APG v2), CONTAINS | Martin 2012, "What data crosses the boundaries"; verbatim |
| G4 | `aggregate-reference-by-identity` | ddd | A class in aggregate A's module holds A' root or inner entity, for another declared aggregate A', in a field (HOLDS_STATE_OF, or a constructor parameter property) | HOLDS_STATE_OF, CONSTRUCTOR_INJECTS + member facts `fields` | Vernon EAD II p. 7; verbatim |
| G5 | `aggregate-holds-service` | ddd | An aggregate root or inner entity injects or holds a type named `*Repository/Repo/Service/Gateway/Dao`, or a declared repository path | CONSTRUCTOR_INJECTS, HOLDS_STATE_OF | Vernon EAD II p. 7 (verbatim); IDDD ch. 10 "harmful" sentence (recalled) |
| G6 | `service-stateless` | all (Evans) | A domain- or application-layer class named `*Service`, or under `services/`, assigns a `this.<field>` outside its constructor | member facts `fieldsAssignedOutsideConstructor` | Evans 2003 ch. 5 "Services"; **(recalled)**. The Reference 2015 p. 14 does not have it. |
| G7 | `nest-provider-not-visible` | nestjs | A provider or controller of module M injects a class that another module provides, when M does not provide it and no module M imports exports it (directly or through re-exported modules, up to 4 hops) | MODULE_PROVIDES/IMPORTS/EXPORTS, CONSTRUCTOR_INJECTS | NestJS "Modules"; verbatim |
| G8 | `nest-provider-multiple-modules` | nestjs | A class is listed in the `providers` of two or more modules | MODULE_PROVIDES (role `provider`) | NestJS "Modules", "Shared modules"; verbatim |

**Known limits, all by construction:**
- G2, G3, G5 and G6 recognise roles by name or path, with the defaults in `RULE_GAP_DEFAULTS`. These were fixed before the dev run.
- G4 and G5 need `architecture.ddd.aggregates`.
- G7 does not decide token injections. When a module provides `{ provide: X, useClass: Y }` and a consumer injects `X`, no module provides the class `X`, so G7 reports nothing.
- G7 cannot see `@Global()`, because decorators are not ingested. A declared `globalModulePatterns` list is the only escape.
- G1 reuses the spec's domain forbidden list. NestJS presets drop `@nestjs/*` from it, so G1 then reads only ORM and web packages.

**Fixtures.** `tests/fixtures/v1.3-rule-gaps` has three projects (`layers`, `ddd`, `nest`) and 37 cases.
- Every rule has at least one violating case, one clean case and one look-alike case.
- Examples of look-alikes:
  - `@nestjsx/crud` against `@nestjs/*`;
  - a composition root that imports `express`;
  - `RepositoryLinkFormatter`;
  - a port interface that returns an entity;
  - a private method;
  - a value object (`Money`, `ServiceLevel`);
  - an entity that keeps state;
  - a plain constructor parameter;
  - a same-aggregate inner entity;
  - a provider reached through a re-exported module;
  - a `useClass` token;
  - a provider listed twice in one module.
- The unit test checks that every violating case is reported, that no clean or look-alike case is, and that no other row appears.
- The live runs give the same result on both engines: `results/v1.3-rule-gaps/fixtures-cypher-interp.json` and `fixtures-neo4j.json`. All 37 cases pass, and the live rows equal the mirror rows for all 24 project × template pairs, including with an exclude pattern.

## 4. Results on the dev set (71 variants)

**Run conditions:**
- Two engines, run separately on the same extractions:
  - `--engine cypher-interp`, the in-process interpreter merged into v1.3 in #128;
  - Neo4j 5.26.0 community with the bundled APOC 5.26.0 core, from the dist tarball.
- The two engines return the same 60 rows, row for row, and the same summary.
- Extraction with `{ ...V13_APG2_OPTIONS, fieldState: true }` and components from the spec's layer model.
- The spec's own exclude paths, and the layer models and forbidden lists from each reference `spec.yaml` or `presets/ddd.yaml`.

**Live versus mirror:** on both engines, the live Cypher rows equal the mirror rows on all 71 variants × 8 templates. There were no errors.

**Fire counts.** Each cell gives rows / variants with a row / distinct findings. A finding is identified by its file, target and discriminator columns, per style.

| Rule | clean-architecture (14) | layered (13) | nestjs (14) | hexagonal (15) | ddd (15) | rows | distinct |
|---|---|---|---|---|---|---|---|
| G1 use-case-framework-free | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| G2 controller-bypasses-application | 1 / 1 / 1 | 1 / 1 / 1 | 0 | 1 / 1 / 1 | 0 | 3 | 3 |
| G3 use-case-exposes-entity | 0 | 0 | 0 | 0 | 2 / 2 / 2 † | 2 | 2 |
| G4 aggregate-reference-by-identity | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| G5 aggregate-holds-service | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| G6 service-stateless | 0 | 13 / 13 / 1 | 42 / 14 / 3 | 0 | 0 | 55 | 4 |
| G7 nest-provider-not-visible | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| G8 nest-provider-multiple-modules | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

† Outside the rule's declared style (`clean-architecture`). It is reported for completeness.

**Reading** (not a precision claim; the findings are unlabelled):
- The dev set was built to plant violations of the *existing* rules, so few of these constraints are planted.
- **G2** fires only on three planted variants, and each fire is on the dependency the plant added:
  - clean `v07-controller-reads-entity`: `LoanController` holds `LoanRepository`. The import points inward, so FF-S01 is silent.
  - layered `v03-controller-reads-gateway`: also FF-S03 at file level.
  - hexagonal `v05-inbound-adapter-reads-outbound-adapter`: also layer-skip-graph.
- **G3** fires on two DDD plants that pass an entity into an application method. FF-DT01 and FF-DS02 already report those variants.
- **G6** fires on every variant of layered and nestjs, including `clean`. `OrderService`, `AttendeesService`, `RegistrationsService` and `WorkshopsService` keep a `private sequence` id counter that they increment in a method. That is service state as Evans defines it. Whether it is architecturally meaningful is for the labeller.
- **No rule fires on any clean variant of clean-architecture, hexagonal or ddd.**
- G1, G4, G5, G7 and G8 have no planted case in the dev set. Their only evidence is the fixtures.

**Sample for labelling:** `results/v1.3-rule-gaps/reference-sample.md` (`reference-neo4j-sample.md` is the same list from the Neo4j run). It has every distinct finding (fewer than 10 per rule exist), with the row, the variants it occurs in, a code excerpt with the reported line marked, and an empty label field. All rows are in `reference-rows.json`. The counts are in `reference-summary.json`. The Neo4j run's files carry a `-neo4j` suffix after `reference`.

## 5. E1 projects: not run

The E1 mode (`rule-gaps-run.ts e1 --e1-runs results/e1-grid/runs --e1-root ../daedalus-e1-outcomes --spec specs/clean-arch.yaml`) is implemented. It uses the pinned ADR-032 tsconfig per cell, as `ise-e1.ts` does. It stopped with `E1 outcomes not found at …/daedalus-e1-outcomes`. The 72 generated E1 projects are not distributed with the repository (`replication/README.md` §1), and the run records hold no code. The E1 fire counts and samples remain to be produced on a machine that has the outcomes. The command above writes `e1-rows.json`, `e1-summary.json` and `e1-sample.md` next to the reference files.

## 6. Reproduce

```bash
npx jest --maxWorkers=2 tests/unit/fitness-compiler/rule-gap-templates.test.ts
npx tsx scripts/v1.3/rule-gaps-run.ts fixtures  --out results/v1.3-rule-gaps      # cypher-interp, no server
npx tsx scripts/v1.3/rule-gaps-run.ts reference --out results/v1.3-rule-gaps
# Neo4j 5.26 + APOC running; NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD set
npx tsx scripts/v1.3/rule-gaps-run.ts fixtures  --engine neo4j --out results/v1.3-rule-gaps
npx tsx scripts/v1.3/rule-gaps-run.ts reference --engine neo4j --out results/v1.3-rule-gaps
npx tsx scripts/v1.3/rule-gaps-run.ts e1 --e1-runs results/e1-grid/runs --e1-root ../daedalus-e1-outcomes --spec specs/clean-arch.yaml --out results/v1.3-rule-gaps
```

## 7. Before thesis use

- Check in print the (recalled) wording:
  - Evans 2003 ch. 5, "Make the SERVICE stateless", and its page;
  - Vernon 2013 ch. 10, the sentence that repository or service injection into an aggregate is "harmful";
  - Fowler 2002 ch. 9, the Service Layer intent, p. 133;
  - Martin 2017 ch. 11, ch. 26 and ch. 28 (rows C14–C16).
- G4 is stricter than Evans. Evans allows references to another aggregate's root (Reference p. 16); Vernon prefers identity and lists reasons to break the rule.
- Promoting any of these rules to blocking needs the ADR that `Docs/v1.3/rule-tiers.md` requires. Its reason must be a construct reason, not the precision observed here.
