# Cheap semantic proxies (pass 0.5): design

Written 2026-10-15 on branch `v1.3-cheap-semantics`. Code: `src/apg-enrich/cheap/`. Results: `Docs/DiagnosticRuns/cheap-semantics-2026-10-15.md`.

## Purpose

The author's direction is to "win the cheap, quick, easy" signals with deterministic code analysis before building an LLM semantic layer over the graph. Each proxy here is a programmatic approximation of a semantic property: duplicated rule, misplaced responsibility, persistence or framework in the core, low cohesion. A proxy proposes **candidate sites**. It does not give a verdict. The later LLM pass is meant to verify the candidates.

None of the proxies uses an LLM, Neo4j or the network. The proxies are deterministic: the same project always gives the same facts in the same order. They take about 50 to 130 ms per reference project, on top of extraction (results §5).

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
  - The reference projects are small (5 to 7 components with 2 to 12 files each), so tf is noisy.
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
