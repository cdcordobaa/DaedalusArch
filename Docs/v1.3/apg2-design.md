# APG v2: generic architectural edges (design)

Written 2026-10-15 on branch `v1.3-apg2`. The evidence is in `Docs/DiagnosticRuns/apg2-ablation-2026-10-15.md`.

## Claim

The thesis claim is that the Architectural Property Graph (APG) holds architectural facts that two kinds of tool cannot express:

- import-graph tools such as dependency-cruiser;
- code-graph tools such as graphify, CodeGraphContext and GitNexus (`Docs/v1.3-graph-adapter-notes.md` on branch `v1.3-graph-adapter`).

APG v2 adds five generic enrichments. None depends on an architectural style. Each answers one question that no import edge answers:

| # | Enrichment | Question it answers |
|---|---|---|
| 1 | Type flow across boundaries | Does an internal type (a DB model, an entity, a framework type) leak through the public surface of another layer? This counts even when no import exists. |
| 2 | Components and Martin metrics | Is the component graph acyclic (ADP)? Do dependencies point towards stability (SDP)? Is each component near the main sequence? |
| 2b | Public API surface | Does a consumer bypass a component's entry files? |
| 4 | Async coupling | Which components are coupled at run time without importing each other? |
| 5 | I/O and side-effect boundary | Is I/O confined to infrastructure and adapters? |

## Options and isolation

- `ExtractorOptions.apg2` (default `false`) switches the enrichments on. `ExtractorOptions.components` (default `[]`) gives the components.
- `V13_APG2_OPTIONS = { ...V13_DEFAULT_OPTIONS, apg2: true }` (`src/apg-extractor/types.ts`).
- `V12E_DEFAULT_OPTIONS` and `V13_DEFAULT_OPTIONS` both have `apg2: false`. The v1.3 default stays off so that every reader of a v1.3 graph is unaffected:
  - the frozen and extension templates;
  - the universal metrics;
  - the drift detector;
  - the judge excerpt;
  - the report graph.

  Turning the option on by default is an author decision for later.
- **Byte identity.** With `scripts/apg-hash.ts`, the full `APGResult` JSON of all 21 fixture projects in the repo (the projects that were already there before this unit) was hashed under both `V12E_DEFAULT_OPTIONS` and `V13_DEFAULT_OPTIONS`, on `origin/v1.3` and on this branch. All 42 hashes are identical (`Docs/DiagnosticRuns/apg2-ablation-2026-10-15/byte-identity.json`).
- **Prefix property.** With the option on, the APG v2 output is the v1.3 output (nodes, edges, warnings, coverage, import counts, FLOWS_TO tally, unchanged and in the same order) followed by the APG v2 nodes and edges, plus an `apg2` accounting block on `APGResult`. A unit test checks this (`tests/unit/apg2/apg2-extractor.test.ts`).
- **Types.** The new node and edge types live in `APG2_NODE_TYPES` and `APG2_EDGE_TYPES` (`src/shared/types/enums.ts`), apart from the frozen `NODE_TYPES` and `EDGE_TYPES`, which the v1.2E report schema mirrors. Neo4j ingestion writes the new types after every v1.3 type (`graph-ingester.ts`). On a graph without them, nothing changes.
- **Code.** `src/apg-extractor/apg2/` holds one pass per enrichment:
  - `type-flow.ts`;
  - `components.ts`;
  - `async-coupling.ts`;
  - `io-boundary.ts`;
  - shared helpers in `common.ts`.

  `extractApg2` runs the passes after the v1.3 extraction and over its result.

### Owner of a fact

PUBLISHES, SUBSCRIBES and PERFORMS_IO start at the APG node that owns the code. `ownerNodeId` picks it in this order:

1. the nearest enclosing class Method;
2. the top-level Function: a function declaration, or a variable initialised with an arrow function that the extractor made a Function node;
3. the enclosing Class (constructors, field initialisers, accessors);
4. the File.

Nested functions and callbacks are attributed to the member that contains them.

### Origin of a value

The async and I/O passes need to know which package a receiver comes from. Type resolution alone fails when the package's types are not installed: in a cloud checkout or a fixture, `@nestjs/cqrs` resolves to `any`. So `originOfValue` (`common.ts`) follows **declarations**, in this order:

1. an imported binding gives its module specifier;
2. a variable, field or parameter whose type annotation names an imported type (`private readonly bus: EventBus`, `Repository<User>`) gives that type's import;
3. a variable, field or parameter whose initializer is a `new`, a call or an `await` on such a value (`new PrismaClient()`, `kafka.producer()`, `await amqp.connect()`) follows the initializer;
4. if the declaration route finds nothing, the resolved type's declaring file under `node_modules/<pkg>/` gives the package.

`this.x` resolves through the member `x`. The walk is bounded to depth 6.

## (1) Type flow: SIGNATURE_USES

| Element | Definition |
|---|---|
| Edge | `SIGNATURE_USES`: (Method \| Function) → (Class \| Interface) |
| Properties | `positions` (`param`, `return`), `inferred`, `visibility`, `ownerExported`, `publicSurface` |
| Sources | class methods (`getMethods()`), interface method signatures (one per name, as the extractor's Method nodes), top-level function declarations, and variables initialised with an arrow function that have a Function node |

**How it is extracted.** The pass reads each parameter's type and the return type from the type checker, so an inferred type is the type the compiler infers. `declarationsOfType` walks the type through:

- union and intersection members;
- alias type arguments;
- array element and tuple types;
- generic type arguments (`Promise<T>`, `Page<T>`, `Map<K, V>`);
- the property types of an anonymous object type (`{ user: UserRecord }`).

The depth limit is 4. Every Class or Interface declaration it reaches that has an APG node becomes a target.

Edge properties:

- `inferred` is true when the type reaches the edge only through a return position with no annotation.
- `visibility` follows the same rules as `member-facts.ts`: explicit `public` or no modifier is public, and a `#name` is private.
- `publicSurface = visibility === 'public' && ownerExported`.

A method that returns its own class (fluent API) gets no edge to it.

**Limits.**

- Type aliases, enums and type-literal declarations have no APG node, so the pass stops there. It still walks through an alias to the types the alias names.
- Arrow-function class fields and object-literal methods are not Method nodes, so they get no edges.
- An `any` from an unresolved package hides what lies behind it.
- An overload set contributes the implementation signature that ts-morph returns for the method.
- Types that reach the code only through a generic constraint are not followed.

**Literature.**

- Parnas (1972), "On the criteria to be used in decomposing systems into modules": a module's interface should reveal as little as possible of its design decisions. A persistence model in a response breaks this.
- Martin (2017), *Clean Architecture*, ch. 22: data that crosses a boundary should be in the form most convenient for the inner circle, and no entity or database row should pass outward.

## (2) Components and Martin metrics

| Element | Definition |
|---|---|
| Node | `Component`: `name`, `filePath = component:<kind>`. Properties: `kind`, `fileCount`, `ca`, `ce`, `componentCa`, `componentCe`, `instability`, `typeCount`, `abstractTypeCount`, `abstractness`, `distance`, `entryFiles`, `publicApiDeclared` |
| Edge | `BELONGS_TO`: File → Component (`kind`, `entry`) |
| Edge | `DEPENDS_ON`: Component → Component (`kind`, `imports`, `typeOnly`) |

**Which components.** Components come from `ExtractorOptions.components`:

- `componentsFromLayerModel(spec.layerModel)` gives one `layer` component per layer (its directories, then its file-name patterns) and one `module` component per DDD context (`<root>/**`, with the context's declared `publicApi`).
- When the list is empty, there is one `folder` component per top-level folder under `src/`, or under the project root when there is no `src/`.

Each kind is a partition: a file belongs to the first declaration of a kind whose `include` globs match it. Only when none matches are the `includeByName` patterns tried, in the same order as the ingestion's layer annotator.

**DEPENDS_ON.** The pass aggregates the **literal** IMPORTS view (`viaReExport` edges dropped; `Docs/v1.3/edge-views.md`) between files of different components of the same kind. This is the view the edge-views table gives the coupling metrics. Package targets are not components.

**Metrics** (Martin 2017, ch. 14, at file granularity):

- `ca` is the number of files outside the component that import a file inside it.
- `ce` is the number of files inside that import a file outside.
- `componentCa` and `componentCe` count distinct components.
- I = Ce / (Ca + Ce). It is `null` when Ca + Ce = 0, where Martin's formula is undefined.
- A = (interfaces + abstract classes) / (classes + interfaces) in the component's files. It is `null` with no types.
- D = |A + I − 1|. It is `null` when A or I is null.

**Limits.**

- Martin counts classes; this pass counts files (one class per file is the norm in the fixtures and reference projects).
- Type aliases and abstract-only function modules do not count towards A.
- Dynamic `import()` edges count like static ones.
- The fan-in and fan-out definitions differ from dependency-cruiser's folder metrics, which count modules. The two tools give different I values for the same folder (ablation document, §Notes).

**Literature.** Martin (2017), *Clean Architecture*:

- ch. 13: component cohesion (REP, CCP, CRP);
- ch. 14: component coupling, covering the acyclic dependencies principle, the stable dependencies principle, the stable abstractions principle, I, A and the main sequence with the zones of pain and uselessness.

Martin (1994), "OO Design Quality Metrics", is the original source of Ca, Ce, I, A and D.

## (2b) Public API surface

| Element | Definition |
|---|---|
| Component properties | `entryFiles`, `publicApiDeclared` |
| Edge | `EXPORTS_SYMBOL`: Component → (Class \| Interface \| Function), with `exportedName`, `entryFile`, `kind` |
| Edge | `DEEP_IMPORT`: File → File, with `component`, `kind`, `publicApiDeclared`, `specifier`, `line` |

**Entry files.** If the component declares a `publicApi`, its entry files are the files that match those globs. Otherwise they are inferred:

- `index.ts` (or `.tsx`, `.mts`, `.cts`) at the component's root directory, which is the common directory of its include globs;
- any file in the component that the extractor marks as `isBarrel`.

**EXPORTS_SYMBOL.** For each entry file, the pass resolves every name in ts-morph `getExportedDeclarations()`, through re-export chains, to a Class, Interface or Function node.

**DEEP_IMPORT.** A literal IMPORTS edge gets a DEEP_IMPORT when all of these hold:

- its target is in a component that has entry files;
- the target is not an entry file;
- the importing file is outside that component.

Type-only and path-alias imports count. Each import edge gets at most one DEEP_IMPORT: the first kind, in declaration order, that sees it.

**Limits.**

- A component with no entry files has no public API to bypass, so imports into it are not checked.
- `export =` and namespace exports resolve only as far as ts-morph resolves them.

**Literature.** Parnas (1972), information hiding: what other modules may rely on is the interface, never the secret behind it. The DDD library's `context-isolation` is the style-specific form of the same construct, for declared bounded contexts. DEEP_IMPORT is the generic form.

## (4) Async coupling: Channel, PUBLISHES, SUBSCRIBES

| Element | Definition |
|---|---|
| Node | `Channel`: `name`, `filePath = channel:<transport>`, property `transport` |
| Edges | `PUBLISHES` and `SUBSCRIBES`: owner → Channel, with `transport`, `via`, `line`, `lines` |

Each transport is detected by package and call shape:

| Transport | Publish | Subscribe |
|---|---|---|
| `event`: node `events`, `eventemitter2`, `eventemitter3`, `@nestjs/event-emitter` | `x.emit('name', …)` where `x` is an emitter (by origin package, by type or base-type name `EventEmitter`/`EventEmitter2`, or `this` in a class extending one) | `x.on / once / addListener / prependListener / prependOnceListener('name', …)`; `@OnEvent('name')` |
| `cqrs-event`, `cqrs-command`, `cqrs-query`: `@nestjs/cqrs` | `EventBus.publish(new E())`, `publishAll([...])`, `CommandBus.execute(new C())`, `QueryBus.execute(new Q())`; the channel is the message class name | `@EventsHandler(E, …)`, `@CommandHandler(C)`, `@QueryHandler(Q)` |
| `queue`: `bullmq`, `bull`, `@nestjs/bullmq`, `@nestjs/bull` | `queue.add(…)` / `addBulk`; the queue name comes from `new Queue('name')` or `@InjectQueue('name')` on the receiver's declaration | `new Worker('name', …)`; `@Processor('name')` |
| `topic`: `kafkajs` | `producer.send({ topic })` | `consumer.subscribe({ topic \| topics })` |
| `amqp-queue`, `amqp-exchange`: `amqplib` | `ch.sendToQueue('q')`, `ch.publish('ex', …)` | `ch.consume('q')` |

**Limits.**

- **Computed names.** A channel name must be a string literal (or a no-substitution template), or a class name for CQRS. A computed name produces no edge; it is counted in `APGResult.apg2.async.dynamicNames`.
- **Channel identity.** A channel is keyed by transport and name only. Two different emitter instances that use the same event name are treated as one channel, a deliberate over-approximation. Conversely, an amqp exchange and the queue bound to it are different channels, because the binding is configuration, not code.
- **Dynamic dispatch.** A receiver passed through an untyped parameter or an `any` has no origin, so it is not detected. A wrapper class around the bus (an in-house `EventPublisher`) is seen only where it extends an emitter.

**Literature.** Hohpe & Woolf (2003), *Enterprise Integration Patterns*: Message Channel, Publish-Subscribe Channel, Event-Driven Consumer, and the loose-but-real coupling of messaging. The sender and receiver share the channel and the message format rather than a reference, so the coupling is invisible to a dependency graph and visible only on the channel.

## (5) I/O boundary: IOCategory, PERFORMS_IO

| Element | Definition |
|---|---|
| Node | `IOCategory`: `name` ∈ {`db`, `http-out`, `fs`, `env`, `clock`, `random`, `process`}, `filePath = io` |
| Edge | `PERFORMS_IO`: owner → IOCategory, with `category`, `apis`, `line`, `lines`; one edge per owner and category |

**Globals.** A global counts only when the name resolves to the TypeScript lib or `@types/node`, not to a project declaration; a local `function fetch()` is not I/O.

- `fetch()` → http-out;
- `Date.now()`, `new Date()` with no argument, `performance.now()` → clock (`new Date(x)` converts a value and reads no clock);
- `Math.random()`, `crypto.randomUUID / randomBytes / randomInt / randomFill / getRandomValues` → random;
- `process.env` → env;
- any other `process.<member>` → process.

**Packages.** A call or `new` on a value whose origin package is in `IO_PACKAGES` (`io-boundary.ts`):

- db: Prisma, TypeORM, Mongoose, MongoDB, pg, mysql, mysql2, sqlite3, better-sqlite3, knex, Sequelize, MikroORM, Drizzle, redis, ioredis;
- http-out: axios, `@nestjs/axios`, node-fetch, got, undici, http, https, http2, superagent, ky;
- fs: fs, fs-extra, graceful-fs;
- process: child_process, execa;
- random: uuid, nanoid, and the random functions of `crypto`.

Decorator calls are excluded: `@Column()` declares a mapping and performs no I/O.

**Limits.**

- I/O behind a project wrapper is attributed to the wrapper, not to its callers. This is intended: the port is where the boundary is.
- The pass does not follow calls (no transitive closure).
- A package outside the table is not I/O.
- Query-builder helpers of an ORM (`In()`, `Like()`) count as db.
- Reads of `process.env` through destructuring of `process` are missed.

**Literature.**

- Cockburn (2005), "Hexagonal Architecture (Ports and Adapters)": the application talks to the outside world only through ports, and adapters do the I/O.
- Martin (2017), *Clean Architecture*, ch. 22: frameworks, databases and the web are details at the outer circle.

Clock, randomness and environment reads are the usual hidden inputs that make core logic untestable. The time and random sources must be injected for a test to be deterministic.

## Extension templates

The templates are in `src/fitness-compiler/apg2-templates.ts`. They are registered as the `apg2` catalogue of `V13_EXTENSION_TEMPLATE_CATALOGUES`, outside the frozen `CYPHER_TEMPLATES`. Their in-memory mirrors are in `src/fitness-compiler/apg2-in-memory.ts`.

| Template | Reads | Parameters | Tier |
|---|---|---|---|
| `boundary-type-leak` | SIGNATURE_USES with `publicSurface` | `controllerLayer`, `applicationLayers`, `infraLayer` | **blocking** candidate. This is the dependency rule checked as a signature fact: an exposing layer (controller or application) names an infrastructure type. |
| `component-adp-cycle` | DEPENDS_ON on a cycle | — | **blocking**. ADP at component level; a structural fact, the same construct as FF-S02. |
| `component-sdp-violation` | DEPENDS_ON with I(a) < I(b) | — | advisory. Compares two metrics. |
| `component-main-sequence-distance` | Component.distance > `$threshold` | `threshold` (default 0.7 in `apg2Params`) | advisory. Metric threshold. |
| `deep-import-declared-api` | DEEP_IMPORT, declared public API | — | **blocking**. A declared public API is bypassed; a structural fact against a declaration. |
| `deep-import-inferred-api` | DEEP_IMPORT, inferred entry files | — | advisory. The public API is a convention (index or barrel). |
| `undeclared-async-coupling` | PUBLISHES and SUBSCRIBES of one Channel, publisher and subscriber in different components of one kind | `allowedAsync`: `"subscriber->publisher"` pairs, or the hexagonal `allowedDependencies` | advisory. Channels are keyed by literal name, a heuristic of run-time coupling. |
| `io-outside-adapters` | PERFORMS_IO to db, http-out or fs from a domain or application member | `domainLayer`, `applicationLayers` | **blocking**. I/O at the edges is core isolation. |
| `nondeterminism-in-core` | PERFORMS_IO to clock, random, env or process from a domain or application member | `domainLayer`, `applicationLayers` | advisory. A testability guideline, not a defining constraint. `process` is put here with env. |

The tiers apply the principle of `Docs/v1.3/rule-tiers.md`: a precise structural fact that states a defining constraint is blocking, and a metric threshold or a guideline is advisory. They are held in `APG2_TEMPLATE_TIERS`. They are **not** added to the sealed tier table or to `src/scoring-engine/rule-tiers.ts`, because adding a rule there needs the ADR that the table's first paragraph requires. Until then, a v1.3 run that names one of these templates gets the scoring engine's `untiered-default` (advisory).

The templates are not wired into `compileFunctions`. `apg2Params(layerModel)` binds their parameters the way `bindLayerParams` does (`allowedAsync` and `threshold` are new). The ablation and the unit tests evaluate them through the in-memory mirrors. Each mirror returns the same columns as its Cypher, in the same order, without exclude paths. The Cypher text has not been run against Neo4j in this environment, which has no Neo4j. Run it on the local machine: extract with `V13_APG2_OPTIONS`, ingest, then run each template with `apg2Params` (see the ablation document).

## References

- Cockburn, A. (2005). *Hexagonal Architecture* (Ports and Adapters). alistair.cockburn.us.
- Hohpe, G., & Woolf, B. (2003). *Enterprise Integration Patterns*. Addison-Wesley.
- Martin, R. C. (1994). *OO Design Quality Metrics: An Analysis of Dependencies*.
- Martin, R. C. (2017). *Clean Architecture*. Prentice Hall. Ch. 13 (Component Cohesion), ch. 14 (Component Coupling), ch. 22 (The Clean Architecture).
- Parnas, D. L. (1972). On the criteria to be used in decomposing systems into modules. *Communications of the ACM*, 15(12), 1053–1058.
