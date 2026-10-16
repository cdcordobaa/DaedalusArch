# Cheap semantic proxies (pass 0.5): design

Written 2026-10-15 on branch `v1.3-cheap-semantics`. Code: `src/apg-enrich/cheap/`. Results: `Docs/DiagnosticRuns/cheap-semantics-2026-10-15.md`.

## Purpose

The author's direction is to "win the cheap, quick, easy" signals with deterministic code analysis before building an LLM semantic layer over the graph. Each proxy here is a programmatic approximation of a semantic property: duplicated rule, misplaced responsibility, persistence or framework in the core, low cohesion. A proxy proposes **candidate sites**. It does not give a verdict. The later LLM pass is meant to verify the candidates.

None of the proxies uses an LLM, Neo4j or the network. The proxies are deterministic: the same project always gives the same facts in the same order. They take about 60 to 130 ms per reference project, on top of extraction (results §5).

## Placement and contract

- **Separate module.** The proxies live in `src/apg-enrich/cheap/`, not in `src/apg-extractor/`, because another unit is changing the extractor core for APG v2. The extractor is read, never edited. `enrichCheap({ apg, project, projectRoot, layerModel })` takes:
  - the in-memory `APGResult`;
  - a ts-morph `Project` over the same tsconfig, opened with dependency resolution on so that package types resolve;
  - optionally, the spec's `LayerModel`.

  `extractAndEnrich(root, …)` is a convenience wrapper that calls `extractAPG` and opens the project.
- **Output.** `enrichCheap` returns `CheapEnrichment`, which holds:
  - `edges`: new edge types `SAME_LOGIC_AS` and `SHARES_LITERAL` between APG node ids. They are not added to `EDGE_TYPES` or to any frozen schema;
  - `nodeFacts`: properties written on existing Class, Method or File nodes, such as `lcom4`, `logicDensity`, `nameRole`, `behaviourRole`, `conceptTags`, `community` and `docText`;
  - `flags`: the facts past a proxy's threshold, each with a file, a line span, a score and the class and method it is about;
  - per-proxy `summaries` and `timingsMs`.

  Nothing is written to Neo4j. A later unit can persist these as `cheap.*` properties.
- **Layer, layer kind and component.**
  - **Layer**: the instrument's own `annotateNodes` over the spec's `LayerModel`. **Layer kind**: `LayerDefinition.kind`.
  - **Component**: the declared DDD bounded context when the spec has one. Otherwise, the first directory under the source root (`src/order/…` → `order`).
  - **Limit.** In a layer-first project (`src/domain`, `src/application`) the components coincide with the layers. A cross-component signal there is a cross-layer signal.
- **Package resolution.** I/O and framework facts come from the type checker. A callee, decorator or type counts when its declaration comes from a catalogued package. The package is identified in one of three ways:
  - a `node_modules/<pkg>` path;
  - an ambient `declare module '<pkg>'` (the reference projects' `types/vendor.d.ts`);
  - a tsconfig `paths` alias named like a package (the `antipattern-nest` fixture's `vendor/typeorm.d.ts`).

  An import line alone is never enough.
- **Thresholds.** All are options (`CheapOptions`) with documented defaults. No threshold was set or changed by looking at a planted seed. Four definitional changes were made once, after the first run on the **clean** reference projects. They are listed with their before and after numbers in the results document, §6.

## The proxies

### 1. CLONES: duplicated logic

- **Definition.**
  - **Units.** There are two granularities:
    - body units: every method, accessor and top-level function body;
    - fragment units: every top-level compound statement of a body (`if`, `switch`, `try`, loops). This is where a duplicated guard or rule lives.
  - **Tokens.** The leaf tokens of the AST. Identifiers become `$id`, numbers `$num`, and strings and templates `$str`. Keywords and operators stay.
  - **Exact clones.** An exact structural clone (Type-1 or Type-2) is an equal SHA-1 of the normalised token string.
  - **Near clones.** A near clone (Type-3) has a token 3-shingle Jaccard of at least `nearCloneThreshold` (default 0.8). Pairs are pre-filtered by size ratio.
  - **Minimum sizes and exclusions.**
    - A body must have at least `cloneMinBodyTokens` tokens (30, the default minimum of CCFinder).
    - A fragment must have at least `cloneMinTokens` tokens (12).
    - A fragment must contain a value comparison or numeric arithmetic. A bare existence check such as `if (!x) throw …` has the same Type-2 shape in every component.
    - A unit is never paired with one that contains it, or with another unit of the same method.
- **Fact.** `SAME_LOGIC_AS` between the enclosing Method or Function nodes. It records `similarity`, `cloneType` (`exact-structural` or `near`), `granularity`, `tokens`, `crossComponent` and `components`.
- **Flag.** Each end of a cross-component pair.
- **Semantic property.** "The same rule is encoded in two places" (DRY, Hunt and Thomas 1999; *Duplicated Code*, Fowler 1999; an invariant enforced in one place, Evans 2003).
- **Literature.**
  - Roy and Cordy (2007), *A survey on software clone detection research*, Queen's TR 2007-541: the clone types and the token-based family.
  - Kamiya, Kusumoto and Inoue (2002), *CCFinder*, IEEE TSE 28(7): token normalisation and the 30-token minimum.
- **Limits.**
  - Type-2 normalisation makes short, unrelated code look the same. The body minimum and the fragment content rule reduce this but do not remove it.
  - A rule rewritten with a different shape (Type-4, a semantic clone) is invisible.
  - Intentional duplication across bounded contexts, which DDD accepts, is flagged like any other duplication.
  - O(n²) over units: fine at reference-project size, too slow for the corpus without LSH bucketing.

### 2. SHARED LITERALS: one constant or message in two components

- **Definition.**
  - **Literals read.** String, no-substitution template and numeric literals in value position, with a unary minus folded in.
  - **Literals dropped.**
    - 0, 1, -1 and the common HTTP status codes.
    - Strings shorter than 4 characters.
    - HTTP methods, header names, content types, log levels and `typeof` tags.
    - Identifier-like single-token strings: error codes, event names and keys. A shared tag is how two components state one contract.
  - **Positions dropped.** Arguments of log calls, and literals in imports, exports, type positions and decorator arguments (routes and column options are framework configuration).
  - **Grouping.** Literals are grouped by kind and value.
- **Fact.** `SHARES_LITERAL` between the File nodes of each pair of components, with the literal and all its sites.
- **Flag.** Every site of a literal used in two or more components.
- **Semantic property.** One business constant or rule message encoded twice, so a change can update one copy and not the other.
- **Literature.** *Replace Magic Number with Symbolic Constant* (Fowler 1999). There is no established detector literature for the cross-component variant.
- **Limits.**
  - The same text can mean two things.
  - A rule can be duplicated with different literals (a Type-2 clone), which this proxy misses and proxy 1 catches.

### 3. NAME vs BEHAVIOUR: declared role against observed role

- **Definition.**
  - **Name role.** From the class name's camel-case suffix: `*Controller` → controller; `*Repository`, `*Repo`, `*Dao`, `*Store` → repository; `*Service`, `*UseCase`, `*Interactor`, `*Handler` → service; `*Adapter`, `*Client`, `*Gateway` → adapter; `*Entity`, `*Model`, `*Aggregate` → entity; `*Dto`, `*Request`, `*Command`, … → dto; and so on (`behaviour.ts`).
  - **Layer role.** From the declared layer kind.
  - **Behaviour.** Resolved I/O calls by category: db, http-client, mail, fs, messaging and transport, with db split into "through an injected repository" and "direct". A direct use is a global accessor such as `getRepository`, `getManager`, `model`, `new PrismaClient`, `new DataSource` or `createQueryBuilder`, or a call on a raw client type such as `DataSource`, `EntityManager`, `Knex` or `Pool`. Behaviour also covers framework decorators (Nest transport decorators; ORM mapping decorators from a db package) and logic density (proxy 5).
- **Flags.**
  - `repository-does-outbound-io`: a `*Repository` doing HTTP, mail or messaging.
  - `controller-business-logic`: a controller (by name, by `@Controller` or by presentation layer) with a method at or above the density threshold.
  - `service-direct-orm`: a service or use case making a direct ORM call.
  - `domain-persistence-mapping` and `domain-does-io`: a domain-role class with ORM mapping decorators or I/O. A domain-role class is any non-repository class of a domain-kind layer; without a layer, an entity or domain-service name.
  - `dto-does-io`: a DTO doing I/O.
- **Facts.** `nameRole`, `behaviourRole` and `ioCategories` on Class nodes.
- **Semantic property.** "The unit's responsibilities match the role its name and layer declare". This is close to FF-N02's rubric.
- **Literature.** Linguistic antipatterns: Arnaoudova, Di Penta and Antoniol (2016), *Linguistic antipatterns: what they are and how developers perceive them*, EMSE 21(1). Brain Controller: Aniche et al. (2018), EMSE 23(4). Persistence ignorance: Nilsson 2006, Evans 2003.
- **Limits.**
  - The I/O catalogue is a fixed list of npm packages. Project-local wrappers are invisible: an `InMemoryDatabase` class, or a `PrismaService` that extends `PrismaClient`.
  - Suffix roles are English naming conventions.
  - In NestJS-with-TypeORM projects the ORM entity *is* the domain model, so every `*.entity.ts` in a domain layer is flagged. The judge flagged the same files (results §3).

### 4. COHESION: LCOM4 and responsibility breadth

- **LCOM4.**
  - **Graph.** The nodes are a class's instance methods and accessors; the constructor is excluded.
  - **Edges.** Two methods are joined if both access the same field (`this.f`), or if one calls the other (`this.m()`).
  - **Value.** The number of connected components of that graph.
  - **Field list.** The APG's v1.3 member fact `fields` on the Class node (`memberFacts`, on by default). The AST is the fallback.
- **Breadth.** The distinct I/O categories the class reaches, plus the distinct other components its file imports (literal IMPORTS view, `Docs/v1.3/edge-views.md`).
- **Facts.** `lcom4` and `responsibilityBreadth` on Class nodes.
- **Flags.** LCOM4 ≥ 3, or breadth ≥ 4. `*Module` wiring classes are exempt from the breadth flag.
- **Semantic property.** "One class, one responsibility" (SRP).
- **Literature.** Hitz and Montazeri (1995), *Measuring coupling and cohesion in object-oriented systems*, Proc. Int. Symposium on Applied Corporate Computing. Chidamber and Kemerer (1994) for LCOM1.
- **Limits.**
  - Controllers and façades whose handlers each delegate to a different collaborator get a high LCOM4 while being cohesive by design. The one clean-project flag is of this kind.
  - Methods that read no field (pure helpers) each form their own component.
  - None of the five operators changes cohesion in a way that tells seed from twin: AP-DUP-RULE and its twin both add one field-free method. So this proxy is designated for no operator.

### 5. LOGIC DENSITY BY ROLE: rules where they do not belong

- **Definition.** Per method, logic density = branches + value comparisons + numeric arithmetic + validation throws.
  - **Branches:** `if`, `?:`, `case` and loops.
  - **Value comparisons:** `<`, `>`, `<=`, `>=`, `==`, `!=`, `===` and `!==`, except against `null` or `undefined`, and except `typeof` checks.
  - **Numeric arithmetic:** both operand types numeric, read from the type checker, so string concatenation does not count.
  - **Validation throws:** a `throw` under an `if` of the same body.

  The values are aggregated per effective role (name role, else decorators, else layer).
- **Facts.** `logicDensity` on Method nodes, and per-role mean, max and count above the threshold.
- **Flag.** A controller or adapter method with density ≥ 3. A guard `if (x <op> v) throw` scores 3. Mapping code (`const q = dto.q`) and null-check-and-throw (score 2) stay below it.
- **Semantic property.** "Business rules live in the domain or application layer, not in the transport or an adapter" (fat controller, misplaced rule).
- **Literature.** McCabe (1976) for decision counting; Aniche et al. (2018), "Brain Controller"; Fowler 2002, *Service Layer*.
- **Limits.**
  - Density measures logic, not business logic. An adapter that simulates a decline (`FakePaymentGateway.charge`) or parses input is flagged.
  - Fat *services* are not flagged, because the role table names controllers and adapters only. The hand-written `ddd/v06-fat-application-service` variant is therefore a miss (results §4).

### 6. REPOSITORY BYPASS: persistence reached around the repository

- **Definition.** A direct ORM or DB client use outside classes in the repository role and outside the infrastructure layer kind. "Direct" has the same meaning as in proxy 3: a global accessor, or a call on a raw client type. Calls through an injected `Repository<E>` field, or a local alias of one, are not direct. Top-level functions outside the infrastructure layer are checked as well.
- **Flag.** Each direct use, at its call line.
- **Semantic property.** "Clients go through the repository, not the persistence technology" (Evans 2003, ch. 6; Fowler 2002; the service-locator anti-pattern in Seemann 2011).
- **Literature.** As in the operator catalogue. There is no detector literature for this exact rule.
- **Limits.**
  - The accessor and raw-type lists are per library (TypeORM, Mongoose, Prisma, Sequelize, Knex, pg, MongoDB).
  - An injected `PrismaService` is the Prisma analogue of a repository, so it is not flagged.
  - A project-local DB wrapper is invisible. This is why the layered `n02` near-miss (a service reading `InMemoryDatabase` directly) gives no flag. In that near-miss, the read is allowed by the style anyway.

### 7. FRAMEWORK TYPES IN CORE

- **Definition.** For every method and top-level function of an application- or domain-kind file, the type checker gives the type of each parameter and the return type. A type counts when it, or a union member, intersection member, type argument (`Promise<Response[]>`) or array element (depth ≤ 4), is declared in one of:
  - a transport package: express, fastify, koa or the Nest platform packages;
  - `@nestjs/common` as an execution-context type;
  - Node `http` as `IncomingMessage` or `ServerResponse`;
  - in domain-kind files only, a db package.

  Type-only imports and inline `import('express').Request` count. Constructors are skipped, because their parameters are DI wiring.
- **Flags.** `framework-type-parameter` and `framework-type-return`.
- **Semantic property.** "Frameworks are details" (Martin 2017, ch. 32). The use case does not know the delivery mechanism (Cockburn 2005).
- **Literature.** As above. FF-P01 `domain-purity` checks the import edge. This proxy checks the type in the signature, so it also sees application-layer files and type-only imports.
- **Limits.**
  - Framework types used only inside a body are not read. A body that builds an express `Response` is proxy 3's case, through I/O.
  - A project re-declaration of `Request` is not a framework type, by design.

### 8. VOCABULARY: concepts per component and vocabulary leakage

- **Definition.**
  - **Terms.** Every identifier of a component's files, split on camel case, lower-cased, at least 3 letters, minus a stop list of language and framework words. Import declarations are skipped.
  - **TF-IDF.** Computed over components as documents. The top `vocabularyTopK` (10) terms are the component's concept tags.
  - **Owner.** The owner of a term is the component with the strictly highest term frequency.
  - **Leakage.** leak(C, D) is the share of C's discriminative term mass (idf > 0, owned) that D owns.
- **Fact.** `conceptTags` on the File nodes of the component.
- **Flag.** A component whose max_D leak(C, D) ≥ 0.5, only when there are 3 or more components.
- **Semantic property.** "A component speaks its own domain language" (ubiquitous language per bounded context, Evans 2003, ch. 2 and 14). A component that mostly talks about another component's concepts is a misplaced module or a missing boundary.
- **Literature.** Salton and Buckley (1988), *Term-weighting approaches in automatic text retrieval*; Kuhn, Ducasse and Gîrba (2007), *Semantic clustering: identifying topics in source code*, IST 49(3).
- **Limits.**
  - The reference projects are small (3 to 6 components with 1 to 16 files each), so tf is noisy.
  - Layer-first projects have layer "components", which naturally share vocabulary. The maximum observed leakage on the clean projects is 0.40 (`hexagonal` application → domain), below the threshold.
  - A deliberately shared kernel or published language looks like leakage.

### 9. COMMUNITIES: does the dependency structure match the declared structure?

- **Graph.** The file graph over the project's File nodes. Each edge has weight 1 per edge of these types:
  - literal-view IMPORTS;
  - CONSTRUCTOR_INJECTS, mapped to files;
  - CALLS, mapped to files.

  The graph is undirected, with self-loops dropped.
- **Partition.** Louvain modularity communities (resolution 1). The implementation is in `louvain.ts`, with no dependency, and is deterministic: input order, ties to the first community.
- **Comparison.** The adjusted Rand index of the partition against the declared layers (files with a layer) and against the components.
- **Facts and flags.** A `community` property on File nodes. A `community-component-mismatch` flag for each file of a community of two or more files whose majority component differs from the file's own.
- **Semantic property.** "The declared modules are the real modules": high cohesion within and low coupling between, as recovered by software-clustering work.
- **Literature.** Blondel, Guillaume, Lambiotte and Lefebvre (2008), *Fast unfolding of communities in large networks*, J. Stat. Mech. P10008. Hubert and Arabie (1985), *Comparing partitions*, J. Classification 2. For software modularisation, Mitchell and Mancoridis (2006), *On the automatic modularization of software systems using the Bunch tool*, IEEE TSE 32(3).
- **Limits.**
  - Layered and clean architectures are *meant* to have edges across layers, so communities follow use cases (vertical slices), not layers. The ARI against layers is therefore low on clean projects: −0.09 to 0.45.
  - The mismatch flags (42 on the five clean projects) are a **diagnostic**, not a defect signal. They are reported apart from the precision counts of the other proxies.
  - Louvain can return poorly connected communities (Traag et al. 2019, Leiden), which matters little on graphs of 30 files.

### 10. DOC TEXT

- **Definition.** The JSDoc and leading `//` and `/* */` comments of every class, method and top-level function, with comment markers stripped.
- **Fact.** A `docText` property on the node. There is no flag.
- **Purpose.** The natural-language input of the future LLM pass: what the author says a unit does, to compare with what it does.
- **Limits.** Few comments in the clean reference projects (1 to 12 commented units of 52 to 63). Stale comments are kept as written.

## Use in the pipeline

- The proxies are a **pass 0.5**, run after extraction and before any judge.
- **Plan for the LLM layer.** This is not done here. The layer judges only flagged units, and gives the flag's message and evidence as the question. This turns the judge into a verifier of a named candidate, instead of a reviewer of a capped unit sample.
- **Proxies that only describe.** Communities, vocabulary tags, doc text and the per-role density aggregates describe the project. They are context for the judge, not candidates.

## What this design does not claim

- It does not claim validity. The proxies were written **after** the five frozen operators and the judge round-1 results had been read, and each operator was given a designated proxy. A high catch rate on the operators' own seeds is therefore close to circular: it shows that the proxies implement what they were written to detect.
- The independent evidence is weaker but real:
  - the hand-written violation variants of the reference projects, written before this unit (results §4);
  - the false-flag counts on the clean projects and near-misses (results §5).
- Corpus precision, and recall on defects the author did not anticipate, are open questions.

---

# Batch 2: error flow, reachability, SDK spread, test topology, config surface, co-change, agent provenance

Written 2026-10-15 on branch `v1.3-cheap2`. Code: `src/apg-enrich/cheap/` (one module per enrichment, plus the shared call graph `callgraph.ts` and read-only git access `git.ts`). Templates: `src/fitness-compiler/cheap2-templates.ts` with in-memory mirrors in `cheap2-in-memory.ts`. Fixtures: `tests/fixtures/v1.3-cheap2/`. Results: `Docs/DiagnosticRuns/cheap2-2026-10-15.md`.

## Contract additions

- **Same module style.** Proxies 11 to 16 are context proxies: `enrichCheap(input, { proxies: BATCH2_PROXY_IDS })` runs them over the APG and the ts-morph project, with no LLM, no Neo4j and no network. The default `proxies` is still the ten batch-1 proxies (`PROXY_IDS`), so a batch-1 run is unchanged. Proxy 17, agent provenance, compares many snapshots, so it has its own entry point, `analyseProvenance(history, options)`.
- **New edge types** (`CheapEdgeType`): `THROWS`, `CATCHES`, `REACHES`, `TESTS`, `READS_ENV`, `CO_CHANGES_WITH`, `CREATED_AT_STEP`, `MODIFIED_AT_STEP`, `REIMPLEMENTS`. As in batch 1, none is added to `EDGE_TYPES` or to a frozen schema.
- **Virtual nodes** (`CheapVirtualNode`, `CheapEnrichment.virtualNodes`). Some facts point at things with no APG node. Their ids are namespaced so they never collide with the 16-hex APG ids:
  - `ErrorType` (`error:<module>#<Name>`): a package or built-in error class;
  - `EntryPoint` (`entry:<kind>:<file>:<line>:<name>`);
  - `EnvKey` (`env:<KEY>`, `env:*` for a computed key);
  - `TestFile` (`test:<path>`): test files are excluded from extraction;
  - `Step` (`step:<n>:<turnId>`).
- **Thresholds.** All are new `CheapOptions`: `envSharedComponents` (2), `coChangeMinSupport` (3), `coChangeMinConfidence` (0.5), `coChangeMaxFilesPerCommit` (30) and `coChangeHistory` (`own`). The provenance thresholds are `ProvenanceOptions`: concept Jaccard 0.5, member Jaccard 0.3, and at least 2 shared member terms. Every default was set before the first run. One definitional change was made after the first run on the reference projects: the test-support exemption of proxy 12, reported with its before and after numbers in the results.
- **The extractor is read, never edited.** Byte identity holds: `tests/unit/apg-extractor/v12e-byte-identity.test.ts` passes.

## Shared: the resolved call graph (`callgraph.ts`)

The APG's `CALLS` edge targets class `MethodDeclaration`s only. A call through an interface-typed field resolves to a `MethodSignature`, so that call is dropped. Batch 2 therefore builds its own unit-level graph.

- **Units:**
  - methods and accessors (the APG Method node when there is one);
  - a constructor together with its field initialisers;
  - arrow-function class properties;
  - top-level functions (APG Function nodes);
  - the module body of each file (`file:` units).
- **Edges:**
  - `call`: a call resolved by the type checker, with aliases followed;
  - `new`: a constructor;
  - `ref`: a function or method used as a value.

  Every identifier's project declaration is also recorded, for module reachability.
- **Interface calls.** A call on an interface method resolves to the method of every class that implements it, by an `implements` clause (direct or inherited), else structurally (the class has a method of every name the interface declares). A call on a class method also reaches the overrides in its subclasses. This is class hierarchy analysis (Dean, Grove and Chambers 1995), which over-approximates the call targets.
- **Literature.** Dean, Grove and Chambers (1995), *Optimization of object-oriented programs using static class hierarchy analysis*, ECOOP. Bacon and Sweeney (1996), *Fast static analysis of C++ virtual function calls*, OOPSLA (rapid type analysis). Grove and Chambers (2001), *A framework for call graph construction algorithms*, TOPLAS 23(6).

## 11. ERROR FLOW

- **Facts.**
  - `THROWS` (unit → error type). It is direct when a `throw` names the type. It is propagated through the calls of the unit that lie outside a `try … catch` of that unit, computed as a fixpoint. The error type is the APG Class node, or an `ErrorType` virtual node.
  - `CATCHES` (unit → error type). For each `try … catch`, an edge goes to every type its try block can throw. The `handling` property is the first of these that applies:
    - `rethrown`: a `throw` in the catch block;
    - `narrowed`: `instanceof` on the caught value;
    - `translated`: the value is read outside a log call;
    - `logged`: the value only reaches log calls;
    - `swallowed`: no binding, or a binding that is never read.
- **Flags.**
  - `framework-http-exception-in-core`: a direct throw, in a domain- or application-kind file, of a framework HTTP exception or of a project subclass of one. The frameworks covered are `@nestjs/common` `*Exception`, `http-errors`, `@hapi/boom`, `routing-controllers` and `@tsed/exceptions`.
  - `domain-error-swallowed`: a catch in an adapter (an infrastructure- or presentation-kind file) handled as `swallowed` (score 1) or `logged` (0.5), whose try block can throw an error type declared in a domain- or application-kind file. Without a layer model, the rule falls back to class roles and `domain` / `core` directories.
- **Template.** `framework-exception-in-core`, advisory.
- **Semantic property.**
  - The core speaks its own error language, not the transport's status codes ("frameworks are details", Martin 2017, ch. 32).
  - A business failure is not silently lost at the edge.
- **Literature.**
  - Robillard and Murphy (2003), *Static analysis to support the evolution of exception structure in object-oriented systems*, TOSEM 12(2): exception flow over a call graph.
  - Cabral and Marques (2007), *Exception handling: a field study in Java and .NET*, ECOOP: catch blocks that do nothing or only log are common.
  - de Pádua and Shang (2017), *Revisiting exception handling practices with exception flow analysis*, SCAM, and (2017) *Studying the prevalence of exception handling anti-patterns*, ICPC: "dummy handler" and "catch generic" anti-patterns.
- **Limits.**
  - TypeScript has no checked exceptions. A `throw` whose type resolves to no class (a string, `any`) is invisible.
  - Promise `.catch(...)` handlers are not read.
  - Propagation is over the class-hierarchy call graph, so it over-approximates.
  - The framework catalogue is a fixed list. A project's own `HttpError` class that lives in an inbound adapter is not a framework exception, so the `hexagonal/v04` violation analogue is a miss (results §3).

## 12. ENTRY-POINT REACHABILITY

- **Entry points.**
  - `http`:
    - Nest route decorators on a `@Controller` class;
    - handlers given to `get / post / put / patch / delete / options / head / all / use` on an express, fastify or koa-router receiver, where the package is resolved from the receiver's type. A handler can be a reference, a bound method or an inline callback.
  - `message`:
    - `@MessagePattern`, `@EventPattern`, `@OnEvent` and `@Process`;
    - the `handle` / `execute` method of a Nest CQRS handler class;
    - every source of an APG v2 `SUBSCRIBES` edge when the APG has them.
  - `scheduled`: `@Cron`, `@Interval` and `@Timeout`.
  - `main`: the module body and the exported functions of a `main` / `cli` / `server` / `bootstrap` / `container` / `composition-root` file, of a root `index.ts`, or of a file that tests `require.main === module`. A composition root is often a function that its host calls.
- **Facts.**
  - `REACHES` (entry → unit), with the BFS depth.
  - Reaching a constructor also reaches the public methods of its class, because an instantiated object may escape to a caller outside the project (rapid type analysis).
  - For an http or message entry, each `REACHES` edge also says whether some call path with no core unit reaches the unit (`withoutCore`), and whether the unit is an infrastructure adapter.
  - The `EntryPoint` node lists the components the entry reaches and its component paths: the component sequences of the BFS tree, collapsed.
  - Files carry `reachable`.
- **Flags.**
  - `unreachable-module`: a file that declares runtime code and that no entry reaches. A file counts as reached when a reached unit is in it, when a reached unit refers to one of its declarations (types included), or when a reached file imports it at run time. The flag is raised only when the project has at least one entry. Test-support modules are listed in the summary and not flagged. These are files in a `test`, `testing`, `mocks`, `fixtures`, `stubs` or `fakes` directory, files named `test*` or `Test*`, and files with a `.mock`, `.stub`, `.fixture` or `.fake` suffix. This exemption was added after the first run on the reference projects, where it removed both false flags (results §2).
  - `endpoint-bypasses-core`: an `http` or `message` entry with a call path to an infrastructure adapter on which no core unit lies. The path follows calls and function references, not `new`.
    - "Core" means the application-kind layers, or the domain-kind layers when there is no application kind (strict layering).
    - An infrastructure adapter is a unit of an infrastructure-kind file whose class is in the repository or adapter role, or performs catalogued I/O.
    - An interface (a port) on the path does not count as core.
- **Template.** `endpoint-bypasses-application`, advisory.
- **Semantic property.**
  - Every module serves some use (no dead code).
  - A delivery mechanism reaches persistence only through a use case (Jacobson's use-case controllers; Martin 2017, ch. 20 and 22; Cockburn 2005).
- **Literature.**
  - The call-graph references above.
  - On dead code: Romano, Vendome, Scanniello and Poshyvanyk (2020), *A multi-study investigation into dead code*, TSE 46(1).
- **Limits.**
  - Framework-free controllers (the reference projects' plain classes with an `HttpRequest` type) are not entry points. Only `main` entries are found there, so the bypass rule cannot fire on `hexagonal/v05` or `layered/v03` (results §3). Treating every `*Controller` method as an entry would change that, but the change would be made after seeing those analogues, so it is left as future work to be validated on held-out projects.
  - Reflection, string-keyed DI tokens without a provider list, and dynamic `import()` of computed paths are invisible.
  - The escape rule is generous: a class that is constructed reaches all its public methods.

## 13. THIRD-PARTY SDK SPREAD

- **Facts.** Per external package, read from the literal IMPORTS view to Package nodes (node built-ins and the `~` alias excluded):
  - the components and layers of the importing files;
  - spread = importing components / components.

  The project's SDK spread index is the mean spread over the vendor SDKs it imports. Package nodes carry `sdkSpread` and `vendorSdk`. Files carry `vendorSdkOutsideAdapters`.
- **Vendor catalogue** (`VENDOR_SDK`):
  - cloud and SaaS clients: AWS, GCP, Azure, Firebase, Stripe, Twilio, SendGrid, Slack, OpenAI, Anthropic, Octokit, …;
  - HTTP clients: axios, node-fetch, got, superagent, undici;
  - database clients and drivers: Prisma client, Mongoose, mongodb, pg, mysql, redis, ioredis, Supabase;
  - kafkajs and amqplib.

  ORM frameworks whose decorators define the mapping (TypeORM, Sequelize, MikroORM) are left out. FF-P01 and the batch-1 repository-bypass proxy cover them.
- **Flag.** `vendor-sdk-outside-adapters`: a vendor SDK imported by a file that is neither in an infrastructure-kind layer nor declares an adapter- or repository-role class. Without layers, adapter-like directories count instead. A type-only import scores 0.5.
- **Template.** `vendor-sdk-outside-adapters`, advisory.
- **Semantic property.** A vendor is isolated behind an adapter (ports and adapters, Cockburn 2005; the anti-corruption layer, Evans 2003, ch. 14). Its spread measures how much a vendor change would touch.
- **Literature.** The spread index is a degree-of-scattering measure, as in Eaddy et al. (2008), *Do crosscutting concerns cause defects?*, TSE 34(4), applied to one vendor dependency instead of a concern.
- **Limits.**
  - It reads import edges, not uses. An SDK reached through a project wrapper does not count, which is the intended reading.
  - The catalogue is a fixed list.

## 14. TEST TOPOLOGY

- **Facts.** `TESTS` (test file → Class / Function / File) from every `*.spec.ts`, `*.test.ts` and `__tests__/` file under the root. A test file outside the tsconfig is added to the ts-morph project, read only. The `via` property is one of:
  - `instantiation`: `new C()`;
  - `call`: a call that resolves to a project method or function;
  - `reference`: a project class or function in value position;
  - `import`: a production file imported, not type-only.

  Classes and functions carry `tested`. Files carry `component` and `componentUntested`.
- **Flags.**
  - `untested-component`: a component with testable code (a class with a method body, or a function) none of whose units a test exercises.
  - `no-tests`: one flag for a project without any test file. It is a true statement about the project, so it is counted apart from the false flags.
- **Template.** `untested-component`, advisory. It replaces FF-CV05's naming convention ("a test file next to it"). A test anywhere that exercises the unit counts. A co-located spec that only imports a type does not count, and that case is planted in the fixture.
- **Semantic property.** Each component's behaviour is pinned by tests.
- **Literature.**
  - Van Rompaey and Demeyer (2009), *Establishing traceability links between unit test cases and units under test*, CSMR: naming convention versus static call approaches.
  - Qusef, Bavota, Oliveto, De Lucia and Binkley (2014), *Recovering test-to-code traceability using slicing and textual analysis*, JSS 88.
  - White, Krinke and Tan (2020), *Establishing multilevel test-to-code traceability links*, ICSE.
- **Limits.**
  - Only direct uses count, with no transitive coverage. A unit exercised only through another class is untested here.
  - It says nothing about assertion quality.
  - Mocks named in value position count as references.

## 15. CONFIG SURFACE

- **Facts.** `READS_ENV` (owner unit → `env:<KEY>`) from these forms:
  - `process.env.X`, `process.env['X']` and `const { X } = process.env`;
  - `import.meta.env.X`;
  - `get` / `getOrThrow` on a `@nestjs/config` `ConfigService` or a `config` package value.

  A computed key goes to `env:*`. The `outsideConfig` property is set per edge.
- **Flags.**
  - `env-read-outside-config`: a read outside a configuration or infrastructure module. A configuration or infrastructure module is one of:
    - an infrastructure-kind layer;
    - a `config`, `configuration`, `settings` or `env` path segment or file name;
    - a `*Config`, `*Configuration` or `*Settings` class;
    - the composition root.
  - `env-key-shared`: a key read in more than `envSharedComponents` (2) components.
- **Template.** `env-read-outside-config`, advisory.
- **Semantic property.**
  - Configuration enters at one place and is passed in (the twelve-factor "config" factor; dependency injection of settings).
  - No configuration key is a hidden contract between components.
- **Literature.**
  - Rabkin and Katz (2011), *Static extraction of program configuration options*, ICSE.
  - Sayagh, Kerzazi, Adams and Petrillo (2020), *Software configuration engineering in practice: interviews, survey, and systematic literature review*, TSE 46(6).
- **Limits.**
  - Wrapper functions (`env('X')`) and config objects read after construction are invisible.
  - The config-module rule is a naming convention.

## 16. GIT CO-CHANGE

- **History.**
  - `own` (default): the repository whose work tree root is the project root.
  - `enclosing`: the repository that contains the root, restricted to the project directory.

  Merge commits are excluded and renames are not followed. A commit that changes more than 30 files is dropped. Only current File nodes count. With no git binary, no repository or no commit, the proxy writes nothing and its summary says why.
- **Facts.**
  - `CO_CHANGES_WITH` (file ↔ file) when support ≥ k (3), with support, confidence(a→b), confidence(b→a), `crossComponent` and `hiddenCoupling`.
  - A component evolutionary coupling matrix: the commits that touched both components, and the Jaccard share of those among the commits that touched either.
- **Flag.** `hidden-coupling`: a pair of components that some file pair across them co-changes with (max confidence ≥ 0.5), while no static edge joins the two components in either direction. The static edges checked are IMPORTS, RE_EXPORTS, CALLS, CONSTRUCTOR_INJECTS, EXTENDS, IMPLEMENTS, FLOWS_TO and SIGNATURE_USES.
- **Template.** `hidden-coupling`, advisory.
- **Semantic property.** Components that must change together should be visibly coupled, or be one component (the common closure principle, Martin 2017, ch. 13).
- **Literature.**
  - Gall, Hajek and Jazayeri (1998), *Detection of logical coupling based on product release history*, ICSM.
  - Zimmermann, Weißgerber, Diehl and Zeller (2005), *Mining version histories to guide software changes*, TSE 31(6): support and confidence, and the large-transaction cut.
  - D'Ambros, Lanza and Robbes (2009), *On the relationship between change coupling and software defects*, WCRE.
- **Limits.**
  - The proxy needs history, and the reference projects have one or two commits each (results §2).
  - Renames break the chains.
  - Squash-merge workflows understate co-change.
  - A shared dependency on a third component explains some co-change, and it is still flagged.

## 17. AGENT PROVENANCE (`provenance.ts`)

- **Input.** A snapshot history, read in one of two ways:
  - `readLoopRun(runDir)`: the loop harness's own store. This is one snapshot per turn (a gate step with a repair has two), from `run.json`, `steps/step-NN.json` and `snapshots.git`, read through `--git-dir` outside the work tree. Each snapshot carries the run's arm, adapter and model, the task step, the turn's prompt sha256, and the blocking findings the harness recorded.
  - `readGitHistory(repo)`: a plain git history, one commit per step (first parent). Metadata comes from commit trailers (`Turn`, `Step`, `Step-Id`, `Arm`, `Model`, `Adapter`, `Task`, `Prompt-Sha256`) when present.

  Each snapshot is checked out with `git archive` (read only). A tsconfig is supplied when the tree has none, as a loop work tree does. The APG is extracted and the context proxies run on it. APG ids are path-based, so they are stable across snapshots.
- **Facts.**
  - `Step` nodes.
  - On each File of the last snapshot: `createdAtStep`, `lastModifiedAtStep` and `modifiedAtSteps` (provenance records), with `CREATED_AT_STEP` and `MODIFIED_AT_STEP` edges to the Step nodes.
  - On every APG edge: the step that introduced it (`edgeFacts`). This is the first snapshot of the edge's last uninterrupted run of presence.
- **Erosion delta.** For each snapshot, the findings that are new against the previous snapshot, and the findings resolved.
  - Blocking findings: the harness's recorded findings, and, with a layer model, the in-memory dependency-direction rule.
  - Advisory findings: the context proxies' flags.

  Each new finding is attributed in the first way that applies:
  1. to the step that introduced its offending IMPORTS edge, when the finding names a target file;
  2. to the later of its two ends, for a two-ended finding;
  3. to the step that last changed its unit (Method, Function or Class text);
  4. to the step that last changed its file.

  This is the SZZ idea (Śliwerski, Zimmermann and Zeller 2005, *When do changes induce fixes?*, MSR) applied to architecture findings instead of bugs.
- **REIMPLEMENTS.** A unit created at step k is a candidate when one of these holds:
  - it is a clone (batch-1 proxy 1) of a unit that existed at k − 1;
  - for a class, its concept terms (class-name terms minus role words) and its member vocabulary match a class that existed at k − 1.

  Pairs that are related are excluded: one file imports the other (reuse), one type extends or implements the other, or both implement or extend a common type (two adapters of one port).
- **Agent locality.** For each snapshot: the components and layers the turn touched, against the feature's scope. The scope is the components of the files the turn added, or, when it added none, the component it touched most. locality = touched files in scope / touched files.
- **Template.** `agent-reimplementation`, advisory.
- **Semantic property.**
  - An agent extends the system by reusing what exists. Its step stays within the feature's scope.
  - The architecture erosion of a multi-step generation can be traced to the step that caused it. This is the Study 2 erosion outcome, `Docs/v1.3/study2-outline.md`, broken down by step.
- **Literature.**
  - Clone genealogies: Kim, Sazawal, Notkin and Murphy (2005), *An empirical study of code clone genealogies*, ESEC/FSE.
  - Origin analysis: Godfrey and Zou (2005), *Using origin analysis to detect merging and splitting of source code entities*, TSE 31(2).
  - There is no peer-reviewed detector literature for agent re-implementation yet. Industry reports of rising duplication with AI assistants exist (GitClear 2024), but they are grey literature and are not relied on here.
- **Limits.**
  - Each snapshot is extracted in full (about 0.3 to 0.5 s per snapshot on the fixtures), so the cost is linear in the number of steps.
  - Vocabulary matching is English and identifier based.
  - The scope heuristic makes locality trivially 1 when a turn only adds files. In a layer-first project the components are layers, so a feature legitimately touches several of them.
  - The dry-run demo plants a dependency violation but no re-implementation. The re-implementation evidence is the synthetic history only.

## What batch 2 does not claim

The batch-1 caveat applies. The planted fixtures were written together with the proxies, so a full catch on them shows that the proxies implement their definitions. It does not show validity. The independent evidence is the reference projects:

- the false-flag counts on the clean and near-miss variants;
- the hand-written violation analogues. Of those, batch 2 catches none (results §3), and the reasons are the definitional limits stated above.
