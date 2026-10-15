# APG v2 ablation: what only the new edges reveal (2026-10-15)

Branch `v1.3-apg2`, base `origin/v1.3` at `3e2c96ae`. Node v22.22.0, dependency-cruiser 18.4.0 (`experiments/tool-comparison/depcruise`, `npm ci`). Design: `Docs/v1.3/apg2-design.md`.

**Status:** a diagnostic run on a planted fixture suite. It is not a registered analysis and has no pre-registration (author decision). It shows which planted facts each representation can and cannot express. It does not estimate detection rates on real code.

## Question

The thesis claims that the APG holds architectural information that two kinds of tool cannot express:

- import-graph tools (dependency-cruiser);
- code-graph tools (graphify, CodeGraphContext, GitNexus).

For each APG v2 enrichment, the suite plants three to five cases that only that enrichment should reveal, plus near-misses and a clean control. For each case the run asks four questions:

- **(a)** Does the APG v2 extension template report it?
- **(b)** Does the v1.3 APG report it without the new edges? This has two parts:
  - **b1**: the same template on the `V13_DEFAULT_OPTIONS` graph;
  - **b2**: the v1.3 rules closest to the case, at the case's locus.
- **(c)** Does dependency-cruiser report it? This has two parts:
  - with the rules the existing translator (`scripts/depcruise-translate.ts`) emits for the fixture's layers;
  - with the best rule set we could hand-write for the case (`depcruise.hand.json` in each fixture project).
- **(d)** What could graphify express, from its export schema (adapter notes)?

## Method

- **Fixtures.** `tests/fixtures/v1.3-apg2/` has seven projects (`type-flow`, `components`, `components-flat`, `public-api`, `async`, `io`, `control-clean`). The cases are in `tests/fixtures/v1.3-apg2/cases.json`. Each case names:
  - its template;
  - the row fields that identify it (`match`);
  - a locus (source file, target file, package or folder) used to look for the same finding in the v1.3 rules and in dependency-cruiser.
- **(a), (b1).** `scripts/apg2-ablation.ts` extracts each project twice: `V13_APG2_OPTIONS` (with the project's components) and `V13_DEFAULT_OPTIONS`. It runs each template's in-memory mirror (`src/fitness-compiler/apg2-in-memory.ts`) on both graphs. Each mirror is a pure TypeScript predicate that returns the rows its Cypher returns. Layers are annotated with the ingestion's own `annotateNodes`.
- **(b2).** In-memory mirrors of the v1.3 rules nearest to the enrichments (`src/fitness-compiler/v13-in-memory-baselines.ts`), each under its v1.3 edge view:
  - FF-S01 dependency-direction (literal);
  - FF-S02 no-cyclic-deps (literal);
  - FF-P01 domain-purity (resolved, with the project's forbidden packages).

  A row counts if it is at the case's locus. For the type-flow and async cases, the run also lists every v1.3 edge, of any type, between the two locus files (`linkingEdges`). This is the information-level check: if no v1.3 edge relates the two files, no v1.3 template, whatever its text, can relate them.
- **(c).** dependency-cruiser 18.4.0 is run on each project's `src` with the `tsconfig.json`. "Translated" is `translateParsed` over a spec with the project's layers and FF-S01, FF-S02, FF-S04 and FF-P01. "Hand-written" is the strongest rule we could write per enrichment:
  - for type flow: presentation must not import a persistence model;
  - for components:
    - folder-scope `circular` (ADP);
    - folder-scope `moreUnstable` (SDP);
    - module `circular`;
  - for the public API: only `index.ts` may be imported from outside a module (with `$1` group matching);
  - for async coupling: modules may not import each other;
  - for I/O: domain and application may not import an I/O package or a node core module.

  A violation counts if it starts at the locus source (or its folder) and ends at its target (or its folder or package).
- **Pass criterion.**
  - A planted case passes when (a) reports it and (b1) does not.
  - A near-miss passes when (a) does not report it.
  - The control passes when no APG v2 template, no v1.3 rule mirror and no dependency-cruiser rule (translated or hand-written) reports anything in the project.
- **Unit tests.** `tests/unit/fitness-compiler/apg2-templates.test.ts` re-asserts (a), (b1), (b2) and the linking-edge check for every case.

To reproduce:

```
npm ci && (cd experiments/tool-comparison/depcruise && npm ci)
npx tsx scripts/apg2-ablation.ts   # Docs/DiagnosticRuns/apg2-ablation-2026-10-15/{ablation.json,table.md,depcruise/*.json}
npx tsx scripts/apg2-cost.ts       # Docs/DiagnosticRuns/apg2-ablation-2026-10-15/{cost.json,cost.md}
```

## Neo4j: not run here

This cloud environment has no Neo4j, so (a) and (b1) were checked on the in-memory mirrors, not on the Cypher. The Cypher templates are in `src/fitness-compiler/apg2-templates.ts`. The unit tests check their shape: each one reads its APG v2 edges, uses its parameters and returns its mapped columns. Neo4j ingestion writes the new node and edge types (`graph-ingester.ts`).

**The live Cypher run is left for the local machine.** For each fixture project:

1. extract with `{ ...V13_APG2_OPTIONS, components }`;
2. ingest with the project's layer model;
3. run each template with `apg2Params(layerModel, { allowedAsync })`;
4. compare the rows with `Docs/DiagnosticRuns/apg2-ablation-2026-10-15/ablation.json`.

Until that run, the claim "the Cypher returns what the mirror returns" is unverified.

## Results

Summary over the 27 planted cases:

| | APG v2 | APG v1.3 graph (same template) | v1.3 rules at locus | dependency-cruiser, translated | dependency-cruiser, hand-written | graphify (schema) |
|---|---|---|---|---|---|---|
| Detected | **27 / 27** | 0 / 27 | 0 / 27 | 0 / 27 | 10 / 27 | 0 / 27 as a rule; 6 derivable by post-processing its import edges (CP1–CP3, CP6, PA1, PA2) |

All 19 near-misses and the control pass: none is reported by APG v2. Of the 27 planted cases, 17 are reported by APG v2 and by none of the other arms, the hand-written dependency-cruiser rules included:

- TF1–TF4;
- CP4, CP5, CP6;
- AS1–AS5;
- IO1–IO5.

### Case table

Column notes:

- "v1.3 edge between locus files" lists the v1.3 edge types joining the two files: `none` means no v1.3 edge relates them, and `n/a` means the locus is a single file or a package.
- "graphify" is a capability read from its export schema (adapter notes, branch `v1.3-graph-adapter`, L20–34 and L98–139). No graphify export was produced or read.

| Case | Kind | What is planted | APG v2 | APG v1.3 graph | v1.3 rules at locus | v1.3 edge between locus files | dep-cruiser (translated) | dep-cruiser (hand-written) | graphify (schema) |
|---|---|---|---|---|---|---|---|---|---|
| TF1 | planted | Controller returns `Promise<UserRecord>` (inferred) | yes | no | no | none | no | no | no: no type edges |
| TF2 | planted | Inferred `Promise<Array<OrderRow>>` | yes | no | no | none | no | no | no |
| TF3 | planted | Parameter `Parameters<UserRepository['save']>[0]` | yes | no | no | none | no | no | no |
| TF4 | planted | Inferred `{ user: UserRecord }` | yes | no | no | none | no | no | no |
| TF5 | planted | Explicit `UserRecord[]` return, allowed-direction import | yes | no | no | IMPORTS | no | **yes** (presentation must not import `*.record.ts`) | partial: the import edge, not its use |
| NM-TF1..4 | near-miss | DTO mapping; private and protected helpers; application exposing a domain type | no | no | no | n/a | no | no | — |
| CP1 | planted | billing ⇄ shipping, no file cycle | yes | no | no | IMPORTS, FLOWS_TO | no | **yes** (folder `circular`) | derivable (imports), no rule |
| CP2 | planted | catalog → pricing → promo → catalog | yes | no | no | IMPORTS, FLOWS_TO | no | **yes** (folder `circular`) | derivable (imports), no rule |
| CP3 | planted | Stable kernel (I=0.17) → unstable plugins (I=0.5) | yes | no | no | IMPORTS, FLOWS_TO | no | **yes** (folder `moreUnstable`) | derivable (imports), no rule |
| CP4 | planted | Concrete, stable kernel: D=0.83 (zone of pain) | yes | no | no | n/a | no | no | no: no interface kind, A not computable (notes L31–32, L139) |
| CP5 | planted | Interfaces only, unstable: D=1 (zone of uselessness) | yes | no | no | n/a | no | no | no |
| CP6 | planted | core ⇄ plugins: glob-declared modules in one folder | yes | no | no | IMPORTS, FLOWS_TO | no | no (one folder; no file cycle) | derivable only with the module globs, no rule |
| NM-CP1 | near-miss | File cycle inside one component | no | no | **yes** (no-cyclic-deps) | IMPORTS ×2 | **yes** (FF-S02) | **yes** (module `circular`) | — |
| NM-CP2, NM-CP3 | near-miss | Unstable → stable; half-abstract stable component | no | no | no | n/a | no | no | — |
| PA1 | planted | Deep import into a declared public API | yes | no | no | IMPORTS, FLOWS_TO | no | **yes** (index-only rule) | derivable with a hand-declared entry list; no barrel facts (notes L81, L225) |
| PA2 | planted | Deep import behind an inferred index | yes | no | no | IMPORTS, FLOWS_TO | no | **yes** | same |
| PA3 | planted | Type-only deep import | yes | no | no | IMPORTS | no | **yes** | no: type-only imports are lost (notes L104) |
| PA4 | planted | Deep import through a path alias | yes | no | no | IMPORTS, FLOWS_TO | no | **yes** | depends on its alias resolution |
| NM-PA1..3 | near-miss | Through the barrel; module without entry files; inside the component | no | no | no | n/a | no | no | — |
| AS1 | planted | Node EventEmitter `order.placed`: orders → billing | yes | no | no | none | no | no (no import to forbid) | no: no channel kind |
| AS2 | planted | `@nestjs/event-emitter` emit + `@OnEvent` | yes | no | no | none | no | no | no |
| AS3 | planted | bullmq `Queue('restock').add` + `new Worker('restock')` | yes | no | no | none | no | no | no |
| AS4 | planted | kafkajs `send({topic})` + `subscribe({topics})` | yes | no | no | none | no | no | no |
| AS5 | planted | `@nestjs/cqrs` `EventBus.publish(new E)` + `@EventsHandler(E)` | yes | no | no | none | no | no | no |
| NM-AS1..4 | near-miss | Computed name; project `Logger.emit`; same-module pair; allowed pair | no | no | no | n/a | no | no | — |
| IO1 | planted | `Date.now()` in a domain entity | yes | no | no | n/a | no | no | no: no global-call edges |
| IO2 | planted | `new Date()` in a domain entity | yes | no | no | n/a | no | no | no |
| IO3 | planted | `Math.random()`, `crypto.randomUUID()` in a domain service | yes | no | no | n/a | no | no | no |
| IO4 | planted | `process.env` in an application service | yes | no | no | n/a | no | no | no |
| IO5 | planted | Global `fetch()` in an application service | yes | no | no | n/a | no | no | no |
| IO6 | planted | TypeORM `repository.find()` in an application service | yes | no | no (FF-P01 is domain-only) | n/a | no | **yes** (application must not import `typeorm`) | partial: the package import (notes L76), not the call |
| IO7 | planted | `readFileSync` from `fs` in an application service | yes | no | no | n/a | no | **yes** (no `fs`, no core modules) | partial: same |
| NM-IO1, 2, 4, 5 | near-miss | `new Date(iso)`; a Clock port; a local `fetch`; I/O in infrastructure | no | no | no | n/a | no | no | — |
| NM-IO3 | near-miss | Type-only `import type { Stats } from 'fs'` in the domain, no call | no | no | **yes** (domain-purity) | n/a | **yes** (FF-P01) | **yes** | — |
| CTL | control | Clean project, every enrichment exercised cleanly | no | no | no (whole project) | — | no (whole project) | no (whole project) | — |

The per-case output, with the matched rule names and paths, is in `Docs/DiagnosticRuns/apg2-ablation-2026-10-15/table.md` and `ablation.json`. The dependency-cruiser configs that were run are in `Docs/DiagnosticRuns/apg2-ablation-2026-10-15/depcruise/`.

### Reading the result per enrichment

**(1) Type flow: the strongest evidence.**

- In TF1–TF4 the v1.3 graph has **no edge of any type** between the controller's file and the leaked type's file. The controller imports the repository, never the record, and the leak happens through inference. So no v1.3 template and no import rule can relate the two.
- TF5 shows the limit of the claim. When the import exists, a hand-written dependency-cruiser rule can forbid it outright. What it cannot do is tell a signature use from an internal use of the same import. APG v2 reports the use.

**(2) Components: partly expressible elsewhere.**

- ADP and SDP between **folders** (CP1–CP3) are expressible in dependency-cruiser 18.4 with hand-written `scope: "folder"` rules (`circular`, `moreUnstable`). The import information is in the v1.3 graph too: no v1.3 rule aggregates it, and the translator emits nothing for it.
- What only APG v2 expresses:
  - abstractness, and with it the distance from the main sequence (CP4, CP5). A needs type kinds; dependency-cruiser has none, and graphify has no interface kind;
  - components declared by globs that do not follow folders (CP6).
- **Layer components are not evidence.** A cycle between ordered layers always contains a backward edge, which v1.3 dependency-direction already reports. So the suite plants component cycles only between unordered modules.

**(2b) Public API: expressible elsewhere.**

- All four deep imports (PA1–PA4) are caught by one hand-written dependency-cruiser rule, using group matching. The v1.3 graph has the import edges; only the DDD library's `context-isolation` reads them as a public-API rule, and only for a declared bounded context.
- APG v2 adds the entry files and EXPORTS_SYMBOL as graph facts, derived from barrels and declarations, so the rule needs no per-project regex. This is a convenience and generality gain, **not** an expressiveness gain over import graphs. The thesis should not claim it as one.

**(4) Async coupling.**

- In AS1–AS5 the v1.3 graph has **no edge** between publisher and subscriber. Both sides import a shared bus, or nothing of each other, so an import-level rule finds nothing to forbid.
- The coupling exists only on a named channel (Hohpe & Woolf 2003). This is information an import graph or a call graph cannot hold.

**(5) I/O boundary.**

- IO1–IO5 use globals (`Date`, `Math`, `crypto`, `process`, `fetch`). There is no import, so no Package node exists, FF-P01 cannot fire, and no dependency-cruiser rule can see them: a global is not a dependency.
- IO6 and IO7 import their packages. A hand-written dependency-cruiser rule catches the imports, and the v1.3 graph has the Package edges, but FF-P01 covers only the domain layer.
- NM-IO3 shows the constructs differ:
  - a type-only `fs` import in the domain is a domain-purity finding and not I/O;
  - IO1–IO5 are I/O and not import findings.

## Extraction cost

The cost is measured with `scripts/apg2-cost.ts`. Each project is extracted with `V13_DEFAULT_OPTIONS` and with `V13_APG2_OPTIONS`, each run in a fresh `node --import tsx` process. Values are the median of 3 runs: wall time of `extractAPG` and the process's peak RSS. The ts-morph project load dominates both and is the same in both modes. The APG v2 pass times are taken from `APGResult.apg2.timingsMs` of the first APG v2 run.

| Project | Files | Nodes v1.3 → v2 | Edges v1.3 → v2 | Time v1.3 (ms) | Time v2 (ms) | APG v2 passes (ms): type flow / components / async / I/O | Peak RSS v1.3 → v2 (MB) |
|---|---|---|---|---|---|---|---|
| v1.3-reference/clean-architecture | 29 | 108 → 112 | 187 → 262 | 393 | 466 | 6.8 / 2.5 / 20.2 / 12.1 | 209 → 213 |
| v1.3-reference/hexagonal | 30 | 110 → 114 | 195 → 271 | 388 | 454 | 8.4 / 3.3 / 17.3 / 9.1 | 210 → 211 |
| v1.3-reference/layered | 27 | 100 → 104 | 186 → 263 | 358 | 417 | 5.8 / 2.8 / 29.6 / 12.4 | 207 → 213 |
| v1.3-reference/nestjs | 29 | 100 → 106 | 193 → 267 | 414 | 497 | 10.1 / 4.4 / 19.2 / 11.6 | 212 → 212 |
| v1.3-reference/ddd | 31 | 103 → 107 | 183 → 265 | 1545 | 1396 | 15.9 / 4.9 / 25.8 / 17.1 | 316 → 316 |
| fixtures/correct-reference | 10 | 44 → 49 | 53 → 86 | 1157 | 1266 | 3.7 / 2.3 / 5.0 / 3.4 | 312 → 313 |
| fixtures/variant-c-everything | 7 | 55 → 60 | 60 → 91 | 1232 | 1177 | 8.0 / 3.9 / 7.9 / 3.6 | 316 → 313 |
| v1.3-apg2/type-flow | 8 | 29 → 33 | 34 → 57 | 881 | 907 | 10.1 / 2.1 / 3.8 / 2.0 | 285 → 286 |
| v1.3-apg2/components | 18 | 41 → 52 | 52 → 84 | 864 | 907 | 1.3 / 3.7 / 3.6 / 1.3 | 276 → 276 |
| v1.3-apg2/components-flat | 4 | 8 → 9 | 8 → 12 | 861 | 853 | 0.2 / 1.3 / 2.1 / 0.7 | 275 → 276 |
| v1.3-apg2/public-api | 12 | 25 → 30 | 36 → 61 | 933 | 848 | 3.2 / 3.5 / 3.4 / 2.3 | 278 → 278 |
| v1.3-apg2/async | 11 | 37 → 50 | 39 → 68 | 884 | 920 | 4.6 / 2.8 / 9.2 / 2.9 | 275 → 276 |
| v1.3-apg2/io | 9 | 33 → 42 | 28 → 48 | 941 | 892 | 3.2 / 1.7 / 3.7 / 3.5 | 275 → 276 |
| v1.3-apg2/control-clean | 9 | 24 → 31 | 30 → 52 | 954 | 914 | 2.9 / 7.2 / 4.6 / 2.6 | 277 → 284 |

Findings:

- **Time.** On the five v1.3 reference projects (27–31 files), the four passes take 38–64 ms in total: about 10–14 % of a 360–415 ms extraction, and 4 % of the DDD reference's 1.5 s. The end-to-end difference between the two medians runs from −149 ms to +109 ms across all projects. With 3 runs, the noise between processes is larger than the pass time, so only the pass timings are a reliable measure of the added cost.
- **Memory.** The change in peak RSS is between −3 and +7 MB everywhere, within run-to-run noise.
- **Graph size.** APG v2 adds about 40 % more edges on the reference projects, mostly BELONGS_TO and SIGNATURE_USES. It adds 4–6 nodes: the folder components and the I/O categories.

Neither cost nor graph size was measured on a large real project. The async pass walks every node of every file, so it is the pass to watch as projects grow.

## Notes and limits

- **Synthetic cases.** The cases were planted by the author of the enrichment, so they show **expressiveness**: what each representation can state. They do not show **prevalence** or precision on real code. That needs the reference projects and real pairs: the nestjs reference already shows a `new Date()` in `RegistrationsService`, an application-layer clock read that `nondeterminism-in-core` reports as advisory.
- **Hand-written rules.** The hand-written dependency-cruiser rules are our best effort. Someone more expert might do better on a case. The rule forms are recorded so the comparison can be checked.
- **Instability in the two tools.** For the same folder, dependency-cruiser's folder instability can differ from APG v2's. For example, `plugins` is 0.667 in dependency-cruiser and 0.5 in APG v2, because dependency-cruiser counts the modules a folder depends on and APG v2 counts its files that depend outward. Both report the planted SDP case.
- **SDP rows from the cycles.** The planted cycles also produce SDP rows (billing → shipping, catalog → pricing, promo → catalog). A cycle always runs against stability in one direction (Martin 2017, ch. 14). The unit test pins the planted row and one near-miss rather than the full list.
- **graphify.** The graphify column is a reading of the adapter notes' schema. That prototype "did not install or run" any tool. CodeGraphContext and GitNexus have the same gaps for (1), (4) and (5): none has a type-signature, channel or global-call edge (notes L98–100).
