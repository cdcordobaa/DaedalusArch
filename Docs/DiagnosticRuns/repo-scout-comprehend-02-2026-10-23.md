# REPO-SCOUT for COMPREHEND-02: large TypeScript codebases for a comprehension test at scale

**Run:** 2026-10-22 (UTC), about 20:40–23:50, in a cloud sandbox. The file name follows the round's date.
**Status:** exploratory, **v1.5-exp**, development material. **Zero model calls:** no `claude -p`, no API.
**Code and records:** `experiments/repo-scout/`. Clones lived in a scratch directory outside the repository; no
third-party source is committed, only URL plus commit and derived numbers.
**Not changed:** `src/`, `presets/`, `scripts/lib/`, `scripts/v1.3/`, the tag `v1.4-freeze-2026-10-20` and every
registered Study 2b artefact. The extractor, the graph-fidelity harness and the DETECT-02 graph tools were imported
read-only.

**The question COMPREHEND-02 will ask.** When a codebase is too large to read in full, does the property graph give an
agent more *complete* knowledge of its structure? Examples are every command that writes X, every caller affected by
changing a port, and every cross-context call. This scout looks for real repositories that can carry that test. It
also takes a first, zero-call reading of how complete the graph is at that scale.

## 1. Result in one paragraph

Of 82 repositories measured (the 74 of the v1.3 external and wild sets, plus 8 new candidates), **two meet all five
criteria: Medusa and Backstage.** Both are MIT or Apache-2.0, have 2,000 to 2,450 production files and about 200,000
to 233,000 lines, and pass their own type check or build here. Both also declare their module boundaries in code and
in docs, and Backstage enforces them with a lint rule.

**Novu** meets four: its own type check of the API could not be reproduced here. **No v1.3 repository qualifies.**
- The large ones are copyleft (immich, standardnotes-auth, hedgedoc).
- Or they declare no real boundaries (medplum).
- Or they are too small: 189 files or fewer, except podkrepi-api, ranked 5th.

**Graph against compiler, at zero calls (9 sample questions).** The index under the DETECT-02 tools found every
compiler call site on the class-based trees:
- Backstage: 100%, 100% and 95% site recall, at 100% precision;
- Novu: 100%, 100% and 87%.

It found almost none on Medusa (0%, 3%, 1%). Medusa's cross-module code is functional: steps and workflows are built as
`createStep(name, async () => …)` callbacks, and the index has no unit for such a callback.

The four tools surface less than the index holds:
- `who_writes` returned nothing on all three trees: no aggregate roots of the kind it reads;
- `impact` gives complete *files that reference the port*, but not the callers;
- no tool answers "every caller of this port".

The extractor itself scales: 4–15 s per tree, tsc coverage 0.995–1.000 in the literal view. The 26 Backstage misses
are a new construct, the inline `import('./X').X` type.

**Recommendation:** use Backstage and Novu as the test trees, and Medusa as the third tree with Gw ("graph known
wrong") items. No graft is needed for criterion (c). A graft is optional, only for a trap whose writer is far away
(§7).

## 2. What was run

| Step | Tool | Where |
|---|---|---|
| Clone at a pinned commit (shallow fetch of the SHA, HEAD checked) | `experiments/repo-scout/clone.sh` | 82 repositories; all 82 HEADs matched |
| Files, LOC, tsc without dependencies, boundary signals, licence | `experiments/repo-scout/measure.ts` (harness tsconfig = the v1.3 wild `flattenTsconfig`, imported read-only) | `results/measure-v13.json`, `results/measure-new.json` |
| The repository's own build or type check, dependencies installed with scripts off | `yarn install --mode=skip-build` and `turbo build` (Medusa); `yarn tsc` (Backstage); filtered `pnpm install` and `nx build` (Novu) | §4 |
| Extraction time | `experiments/repo-scout/extract-time.ts` (`extractAPG`, `V13_DEFAULT_OPTIONS`, cypher-interp path, no Neo4j) | `results/extract/` |
| Extraction coverage against tsc | `scripts/v1.3/graph-fidelity.ts project --views`, unchanged | `results/fidelity/` |
| Compiler truth for 3 questions per tree | `experiments/repo-scout/truth.ts` (ts-morph language service; imports nothing from DETECT-02) | `results/compare-*.json` (`truths`) |
| Graph tools against that truth | `experiments/repo-scout/compare.ts` (`buildIndex`, `context_map`, `who_writes`, `trace`, `impact` from `experiments/detect-02/mcp/comprehend/`) | `results/compare-*.json` |
| Ranking | `experiments/repo-scout/rank.mjs`, hand judgements with evidence in `results/judgements.json` | `results/ranked.json` |

**Candidates beyond the v1.3 sets.** The brief's four: Medusa (v2 modules), Backstage, Twenty and Immich. Plus four
found in a short search, each of them TypeScript, large, active and modular: Unleash, Novu, Amplication and Vendure.
The web search returned only small teaching repositories, so these four were chosen from known projects. Every claim
about them was then checked in the code.

**Analysis roots.**

| Repo | Root (and program) |
|---|---|
| Medusa | `packages/modules/*` + `packages/modules/providers/*` + `packages/core/core-flows` + `packages/core/types`, with `@medusajs/*` mapped to sources |
| Backstage | every backend plugin, `-node` and `-common` package, `packages/backend-*`, and the catalog-model, config, errors and types packages, with `@backstage/*` mapped to sources |
| Novu | `apps/api` + `libs/dal` + `libs/application-generic`, with `@novu/*` mapped to sources; `*.e2e.ts` excluded as tests |
| Amplication | `packages/amplication-server` |
| Twenty | `packages/twenty-server` |
| Immich | `server` |
| Unleash | `src/lib` |
| Vendure | `packages/core` |

## 3. Ranked table

**How the criteria are judged.**
- **(a)** passes only when the repository's own type check or build was run here and passed.
- **(b)** needs at least 300 production files and 20,000 lines.
- **(c)** is strong when modules or contexts are declared in code or manifests *and* a rule between them is stated or
  enforced; medium when modules are declared but no rule is stated; weak when there are folders only. (c) passes at
  medium or above.
- **(d)** holds for every TypeScript tree with a tsconfig (§5). It was checked by hand on the three trees below.
- **(e)** needs MIT, Apache-2.0, ISC or BSD for the analysed root.

The rank sorts by the number of criteria met, then by boundary strength.

**"Graph vs compiler" column.** For each sample question, the share of the compiler's call sites that the graph index
holds as resolved call edges (recall). Precision and the per-tool results are in §6.

| # | Repo | Commit | Files | LOC | tsc | Boundaries | Licence | (a)(b)(c)(d)(e) | Extraction | Coverage vs tsc (literal view) | Graph vs compiler, site recall |
|---|---|---|---:|---:|---|---|---|---|---|---|---|
| 1 | **medusa** (medusajs/medusa) | `6cc1a4acab6d` | 2,447 | 232,885 | own `tsc --build`: 13/13 packages pass (product module, core-flows and their deps) | strong | MIT (Enterprise materials excluded; analysed packages MIT) | ✓✓✓✓✓ | 13.9 s | 1.000 / 1.000 (5,447 edges) | MD-W1 0%, MD-C1 3%, MD-X1 1% |
| 2 | **backstage** (backstage/backstage) | `d72327203d5d` | 1,987 | 199,614 | own `yarn tsc`, whole monorepo: 0 errors (164 s) | strong | Apache-2.0 | ✓✓✓✓✓ | 11.1 s | 0.995 / 1.000 (5,296 edges) | BS-W1 100%, BS-C1 100%, BS-X1 95% |
| 3 | **novu** (novuhq/novu) | `894d63ff5252` | 3,068 | 237,333 | partly: `libs/dal`, `packages/shared`, `libs/application-generic` build; the `apps/api` check was not reproduced | medium | MIT outside `enterprise/` | ✗✓✓✓✓ | 14.7 s | 1.000 / 1.000 (9,496 edges) | NV-W1 100%, NV-C1 100%, NV-X1 87% |
| 4 | amplication (amplication/amplication) | `7656495d27f0` | 875 | 44,379 | not verified (no deps: 524 non-module errors) | medium | Apache-2.0 outside `ee/` | ✗✓✓✓✓ | 3.9 s | 1.000 / 1.000 (2,582 edges) | not run |
| 5 | podkrepi-api (v1.3 wild) | `52f5d79d890b` | 576 | 22,720 | not verified (504) | medium | MIT | ✗✓✓✓✓ | – | – | – |
| 6 | twenty (twentyhq/twenty) | `65354f9e1d04` | 8,927 | 617,316 | not run | strong | **AGPL** | ✗✓✓✓✗ | – | – | – |
| 7 | ddd-forum (v1.3 external) | `3aa0b8d3ad3b` | 248 | 7,520 | not verified (71) | strong | ISC | ✗✗✓✓✓ | – | – | – |
| 8 | bitloops-ddd-backend (v1.3 wild) | `daa3f22f9bbf` | 164 | 6,256 | not verified (119) | strong | MIT | ✗✗✓✓✓ | – | – | – |
| 9 | domain-driven-hexagon (v1.3 wild) | `5c2d15a7e2d6` | 82 | 2,400 | not verified (32) | strong | MIT | ✗✗✓✓✓ | – | – | – |
| 10 | unleash (Unleash/unleash) | `56bee648769f` | 942 | 91,863 | not run | medium | **AGPL** (package.json `AGPL-3.0-or-later`) | ✗✓✓✓✗ | – | – | – |
| 11 | vendure (vendure-ecommerce/vendure) | `b6653518cd34` | 725 | 81,242 | not run | medium | **GPL-3.0** | ✗✓✓✓✗ | – | – | – |
| 12 | hoppscotch-backend (v1.3 wild) | `63273f8e599e` | 189 | 24,478 | not verified (301) | medium | MIT | ✗✗✓✓✓ | – | – | – |
| 13 | staart-api (v1.3 external-2) | `075b30d5e4aa` | 132 | 7,659 | not verified (287) | medium | MIT | ✗✗✓✓✓ | – | – | – |
| 14 | medplum-server (v1.3 wild) | `ab8adf08f9d8` | 491 | 88,144 | not verified (847) | weak | Apache-2.0 | ✗✓✗✓✓ | – | – | – |
| … | immich-server (v1.3 wild; and immich `1cf5bb41`, 469 files) | `3ae71117413c` | 458 | 53,812 | not verified | weak | **AGPL** | ✗✓✗✓✗ | – | – | – |
| … | standardnotes-auth (v1.3 wild) | `b7d2f3664e00` | 469 | 19,339 | not verified | medium | **GPL** | ✗✗✓✓✗ | – | – | – |
| … | the other 66 v1.3 repositories | (pins in `results/v1.3-*/selection.json`) | 18–226 | 198–7,171 | not verified | – | MIT/Apache/ISC (clean-ts-api GPL; hedgedoc AGPL) | fail (b) | – | – | – |

The full 82-row table, with every pin, is `experiments/repo-scout/results/ranked.json`. The "no deps" figure is the
number of non-module errors in the harness program without `node_modules`. It is noise from untyped packages and says
nothing about whether the project compiles. For Medusa it was checked. With dependencies installed but nothing
built, the harness program still had 1,697 TS2339 errors, led by `addSql` on MikroORM migrations whose base class
comes from an unbuilt framework package. After the repository's own build, the same program has 14.

**N45: the three largest wild repositories.** These are immich-server, medplum-server and podkrepi-api, where FF-S02
did not finish (`Docs/DiagnosticRuns/v1.3-validity-convergent-2026-10-16.md` §6). Here:
- immich fails (e);
- medplum fails (c);
- podkrepi-api ranks 5th, with 46 NestJS modules and a vacuous Nx boundary rule (`sourceTag: '*'`).

At 22,720 lines it is too small to make reading the whole tree impractical.

## 4. Per criterion, for the top three

**(a) Compiles.**
- **Medusa:** with the dependencies installed, the repository's own `turbo run build` for the product module,
  core-flows and their dependencies ran `tsc --build` in 13 of 13 packages, all passing.
- **Backstage:** the repository's own `yarn tsc` over the whole monorepo finished with 0 errors in 164 s.
- **Novu:** a filtered `pnpm install` plus `nx build @novu/api-service` built `@novu/dal`, `@novu/shared` and
  `@novu/application-generic` with their own `tsc`. Two unrelated SDK packages failed because the filtered install
  left out their build tool. A direct `tsc -p apps/api/tsconfig.json` gave 889 errors, 575 of them modules of
  unbuilt workspace or enterprise packages. (a) is therefore **not shown** for Novu's API. A full install and build is
  the next step if Novu is used.

**(c) Declared boundaries, verified in the code.**
- **Medusa.** One package per module under `packages/modules/`, 30 `Module(Modules.X, …)` definitions. Each module's
  service interface is published in `packages/core/types/src/<module>/service.ts`. The isolation rule is written down
  (`www/apps/book/app/learn/fundamentals/modules/isolation`): "Modules can't access resources, such as services or data
  models, from other modules … Use workflows to build features that depend on functionalities from different modules."
  So cross-module work lives in `packages/core/core-flows` (steps and workflows).
- **Backstage.**
  - ADR011 (`docs/architecture-decisions/adr011-plugin-package-structure.md`) fixes the package structure: `x-backend`,
    `x-backend-module-*`, `x-node`, `x-common`.
  - Every `package.json` declares `backstage.role`: 18 backend-plugin, 78 backend-plugin-module, 31 node-library,
    23 common-library, and so on.
  - The repository's lint rule `@backstage/no-mixed-plugin-imports` forbids a backend plugin importing another
    backend plugin; it must go through the `-node` or `-common` package.
  - 17 ADR files. Of the three, this is the strongest declaration of boundaries.
- **Novu.**
  - `apps/api/src/app/*` holds one NestJS feature module per folder (64 `@Module`). Use cases sit under `usecases/`,
    and persistence in `libs/dal` (one repository and entity per collection).
  - No ADR and no enforced rule for the API. The repository's 7 ADRs and its `CONTEXT-MAP.md` describe the SDK
    packages, not the API. So the boundaries are medium.

**(e) Licence.** Medusa's `LICENSE` is MIT, except the Enterprise Edition materials named in `ENTERPRISE-LICENSE.md`.
Novu is MIT (`LICENSE-MIT`), except `enterprise/` (`LICENSE-ENTERPRISE`). The analysed roots are outside both
exceptions. Amplication is Apache-2.0 outside `ee/`. **Twenty, Immich and Unleash are AGPL and Vendure is GPL-3.0**,
so all four fail (e) despite their size and structure. Unleash's licence, AGPL in both `LICENSE` and `package.json`,
was a surprise and was checked twice.

## 5. The truth method

**Truth is the TypeScript compiler's language service, through ts-morph** (`experiments/repo-scout/truth.ts`). It
imports nothing from `experiments/detect-02/`, so no graph fact is ever taken as truth. It answers three kinds of
question:

| Kind | Compiler query | Answer |
|---|---|---|
| `writers` | find-all-references on each mutating member of a port (a regex over member names). The call sites are kept, grouped by the enclosing named unit. Members a class inherits from its base count only when the receiver's type is that class or a subclass. | sites (file:line), units, files |
| `callers` | the same, over every member of the port; plus every file that references the type at all, and its implementations (`getImplementations`) | sites, units, files, type-reference files, implementations |
| `crossCalls` | every call or `new` in the files of module A whose resolved declaration (`getSymbol`, through aliases) is in a file of module B | sites, units, files, callees |

**Units** are named as the DETECT-02 index names them where it has a unit (`Class.method`, `fn`, `{}.prop`). Otherwise
the unit is the module-level declaration that encloses the call. For example, a `const updateProductsStep =
createStep(…, async () => …)` callback is the unit `updateProductsStep`. That way a call the index cannot hold still
has a name.

**Hand check, one answer per tree (all agree with the compiler).**

| Tree | Item | Hand method | Result |
|---|---|---|---|
| Medusa | MD-W1: writers of products through `IProductModuleService` | text search for `.{create,update,upsert,delete,softDelete,restore}Products(` in every analysed package, each hit read | the same **10** call sites as the compiler. The other 10 text hits are JSDoc examples in `types/src/product/service.ts`. One site is `this.createProducts` inside `ProductModuleService.upsertProducts` itself. |
| Novu | NV-W1: writers of subscribers through `SubscriberRepository` | multi-line text search for `*Subscriber*Repository.{create,update,…}(`, each extra file read | the compiler's **18** files hold 20 sites. The text search finds 17 of them, plus 4 more. Those 4 are `TopicSubscribersRepository` writes (another collection) or `subscriberRepository.findOne/find` reads, so they are correctly excluded. The 18th truth file is the repository's own `this.bulkWrite` in `bulkCreateSubscribers`, which the text search cannot see. |
| Backstage | BS-W1: writers through `ProcessingDatabase` | text search for the write-method names over `plugins/catalog-backend/src`, each hit read | the compiler's **4** sites, all in `DefaultCatalogProcessingEngine` (`processTask`). The other 18 text hits are methods of two other ports with the same names (`ProviderDatabase`, `CatalogDatabase`) or the `processingResult.refresh` helper. The draft question text named those methods too; it was narrowed to `ProcessingDatabase`'s three write members before this report. The result is unchanged, since the interface declares no others. |

On large trees text search both over-reports (same method names on other ports) and under-reports (receivers not
named after the type). That is the gap compiler truth closes, and it is what makes (d) cheap on any compiling tree.

**Limits of the truth.**
- Calls through a dependency-injection token typed `any` (an untyped `container.resolve(…)`) or through a string key
  have no symbol, so they are not in the truth. Medusa's steps resolve typed interfaces, so MD-W1 is not affected.
- Decorator calls (`@IsTagsFilter()`) are calls, so they are in the `crossCalls` truth.
- Units are approximated from syntax.

## 6. Graph against compiler: a first reading of completeness at scale

**What was compared.** For each question (`experiments/repo-scout/questions/<tree>.json`, three per tree), the
answers came from four sources:
1. **The index under the four tools.** These are the resolved call edges, each with its call site and, when it
   crossed a port, the port member. Calls the index records as unresolved count separately, under "lenient". No tool
   can return more than this.
2. **`impact`** on the port and on its in-tree implementation: the files that reference it, and the commands whose
   call tree reaches it.
3. **`who_writes`**, when an aggregate could be named.
4. **`trace`** on one sample command.

Agreement is measured as recall (the share of truth the graph has) and precision (the share of graph rows that are
true). It is measured at three grains: call sites, units and files, all uncapped. The tools themselves show 25 rows,
with the total.

**Index build and first calls.**

| Tree | Files | Units | Call edges | Unresolved calls | Index build | Peak RSS | First `impact` (runs the rules once) |
|---|---:|---:|---:|---:|---:|---:|---:|
| Medusa | 2,815 | 3,499 | 6,618 | 1,301 | 98.6 s | 6.1 GB | 62.7 s |
| Novu | 3,231 | 7,889 | 14,206 | 1,456 | 78.6 s | 4.5 GB | 93.8 s |
| Backstage | 2,229 | 5,929 | 12,798 | 2,581 | 62.9 s | 4.9 GB | 43.0 s |

**Results, per question.** "Index" = resolved edges only (recall / precision, sites). "Lenient" adds the unresolved
calls in the same files.

| Item | Question (short) | Truth (sites / units / files) | Index sites | Index files | `impact`: reference files | `impact`: command files | `who_writes` |
|---|---|---|---|---|---|---|---|
| **MD-W1** | units writing products via `IProductModuleService` | 10 / 5 / 5 | **0% / –** (0 rows) | 0% | 100% / 97% (all 37 type-referencing files) | 20% / 100% | error: no roots (Medusa models are `model.define(…)` objects, not classes) |
| **MD-C1** | callers of `IInventoryService` | 33 / 15 / 15 | **3% / 100%** | 7% | 73% / 85% | 7% / 100% | – |
| **MD-X1** | order workflows → other domains' steps and workflows in core-flows | 323 / 94 / 93 | **1% / 100%** | 2% | – | – | – |
| **NV-W1** | units writing subscribers via `SubscriberRepository` | 20 / 20 / 18 | **100% / 9%** (231 rows) | 100% / 14% | 99% / 100% (95 referencing files) | 17% / 13% | 0 writers |
| **NV-C1** | callers of `IAuthService` (2 implementations) | 31 / 30 / 17 | **100% / 100%** | 100% / 100% | 12% / 67% | 41% / 100% | – |
| **NV-X1** | subscribers-v2 → other API modules | 108 / 40 / 9 | **87% / 100%** | 3 of 9 files | – | – | – |
| **BS-W1** | units writing via `ProcessingDatabase` | 4 / 1 / 1 | **100% / 100%** | 100% / 100% | 100% / 67% | 0% | – (no roots) |
| **BS-C1** | callers of the published `CatalogService` | 39 / 31 / 29 | **100% / 100%** | 100% / 100% | 100% / 100% (40 files) | 0% (no command reaches an interface) | – |
| **BS-X1** | scaffolder backend → catalog code | 19 / 6 / 5 | **95% / 100%** (lenient 100% / 5%) | 100% | – | – | – |

**What the misses are.**

1. **Functional composition is invisible (Medusa).** 92 of MD-X1's 94 truth units, 4 of MD-W1's 5 and 14 of
   MD-C1's 15 are calls inside a callback passed to a factory, such as `createStep` and `createWorkflow`.
   - The index makes units of methods, functions and arrow functions assigned to a name or a property, not of a
     callback argument. So these calls have no unit and no edge.
   - This is the COMPREHEND-01 "functional style" gap (design §9.5), now measured on a large, real tree. In Medusa it
     is where all the cross-module work is.
   - **MD-W1's fifth unit, a class method, is missed too.** `ProductModuleService.upsertProducts` calls
     `this.createProducts`, an overloaded method. The index resolves a call to the first declaration, an overload
     signature with no body, which is not a unit, so the edge is dropped. That is a separate gap: calls to overloaded
     methods.
2. **Receiver-blind inherited members (Novu NV-W1).** Every write goes through members `SubscriberRepository`
   inherits from `BaseRepository` (`create`, `update`, `delete`, …).
   - The index records the callee (`BaseRepository.update`), not the receiver's type. So the index alone cannot tell
     subscriber writes from the writes of the other 44 classes that extend `BaseRepository`: 100% recall at 9% precision.
   - `who_writes` returns nothing: the write parameters are `FilterQuery<T> & T_Enforcement` and `UpdateQuery<T>`,
     not the entity. This is COMPREHEND-01's graph revision 1 (mapped and utility types), at scale.
3. **Decorators and class-level initialisers (Novu NV-X1).** The 14 missed sites are `@IsTagsFilter()`-style
   decorators and property initialisers in DTO classes, outside any unit.
4. **No tool answers "every caller of this port".**
   - `impact(port)` gives the files that reference the type: complete on Medusa MD-W1, Novu NV-W1 and Backstage
     BS-C1. That is a file-level superset; for BS-C1, 40 files against 29 calling files.
   - `impact`'s "commands reaching" starts only from application-layer commands and never from an interface target.
   - `trace` goes downwards from one command.
   - So on NV-C1 and BS-C1 the index holds every call site (100% / 100%), but an agent can reach them only by tracing
     command after command.
   - What `impact` gives instead, for NV-C1: reference files 12% of the caller files, command files 41%. Most
     callers hold the concrete `AuthService`, not the port.
   - For BS-C1: reference files 100%, but they are a superset (40 files for 29 calling files), and command files 0%.
5. **`who_writes` is empty on all three trees.** It reads aggregate roots (declared, or inferred from typed
   repository parameters). None of the three trees has roots of that kind:
   - Medusa: DML model objects, not classes;
   - Novu: generic base-repository parameters, not the entity;
   - Backstage: no aggregates at all.

**Reading (dev).**
- **The index is complete on class-and-interface code at this scale.** That covers Backstage, and Novu after receiver
  typing.
- **The tools are not, in two places.**
  1. There is no caller query.
  2. The write facts rest on DDD-shaped aggregates.
- **On functional composition (Medusa) the graph is close to blind.** There an agent with files only (Grep on
  `IProductModuleService`) would answer the writer question better than the tools.

These are first readings on 9 questions, before any agent session. They are the cases COMPREHEND-02 should label G
(graph answers it) or Gw (graph known wrong) up front.

## 7. Extraction at scale, and the fallback graft

**Extraction.** `extractAPG` with the v1.3 defaults (what `evaluate` uses; no Neo4j) took 3.9–14.7 s and at most
1.2 GB RSS on the four large trees:

| Tree | Extraction | Graph-fidelity harness, total |
|---|---|---|
| Medusa | 13.9 s | 94 s |
| Novu | 14.7 s | 106 s |
| Backstage | 11.1 s | 87 s |
| Amplication | 3.9 s | 13 s |

**tsc-scoped coverage / confirmation by view.**

| Tree | Literal view | Resolved view | Frozen v1.2E default |
|---|---|---|---|
| Medusa | **1.000 / 1.000** (5,447 edges) | 0.647 / 0.513 | 0.647 / 0.513 |
| Novu | **1.000 / 1.000** (9,496) | 0.739 / 0.581 | 0.739 / 0.581 |
| Backstage | **0.995 / 1.000** (5,296) | 0.559 / 0.456 | 0.557 / 0.455 |
| Amplication | **1.000 / 1.000** (2,582) | 0.851 / 0.773 | 0.851 / 0.773 |

**Backstage's 26 missing literal edges** are all inline import types: `createServiceRef<import('./AuthService').AuthService>(…)`
in `packages/backend-plugin-api/src/services/definitions/coreServices.ts` (22 edges) and `src/alpha/refs.ts` (4).
The compiler counts them as references, and the extractor has no edge for an `import('…')` *type*. They are exactly
the declarations of Backstage's dependency-injection table, so a graph without them misses which file declares each
core service.
- This construct did not occur in the v1.3 external and wild sets, where the literal view was exact.
- It is an extractor gap, development material for the v1.3 notes, and is not fixed here.

The resolved and v1.2E views are low for the known reason, barrel routing (ADR-V13-01). On Backstage and Medusa that
is the `@backstage/*` and `@medusajs/*` package barrels, each package's `src/index.ts`.

**dependency-cruiser** agreed with tsc on Medusa, Novu and Amplication. On Backstage it reported no scoped edges:
probably the harness's `paths` map with `*` in the middle, not investigated. tsc is the reference used here.

**A graft is not needed for (c):** Medusa and Backstage meet it as they are. If COMPREHEND-02 also wants a *trap*,
a planned change whose violation depends on a writer far from the edited file, the fallback is small:
1. **Where:** Backstage, which compiles and has the most complete index.
2. **What:** a seeded port in a `-node` package, e.g. `EntityAuditStore` in `plugins/catalog-node`. One write
   member, implemented in `plugins/catalog-backend`.
3. **Callers:** one caller in each of three plugin families (catalog, scaffolder, search), each at least four files
   from the implementation.
4. **The trap:** a question or task that changes the port's write contract. It is answered correctly only by finding
   all three callers.
5. **Known truth:** the seed's own manifest, checked by `truth.ts` on the grafted tree.
6. **Cost:** one patch file under `experiments/repo-scout/graft/` applied at the pinned commit, so the tree still
   compiles under `yarn tsc`.

This is a sketch only; nothing was grafted.

## 8. Recommendation

1. **Backstage, the primary tree.** It meets all five criteria and has the strongest declared boundaries:
   - ADR011, `backstage.role` in every package, and an enforced lint rule;
   - it passes its own whole-repo `yarn tsc`.

   Its index matches the compiler on all three questions (95–100% site recall at 100% precision). So questions there
   test whether *delivering* a complete graph makes an agent's answers more complete. That is the COMPREHEND-02
   question.

   Questions should start from the published `-node` services: `CatalogService`, `ProcessingDatabase`, the
   scheduler, permissions and auth services. There a change ripples across plugin families.
2. **Novu, the second tree.** It has the most code (3,068 files, 237,000 lines) and declares its NestJS modules and
   the use-case and DAL layers. The index holds every caller and cross-module call except decorators.

   Two conditions:
   - (a) must be shown first: a full install and `nx build`, or a pinned build script, before any session;
   - its writer questions are Gw for `who_writes` (the generic base repository) until graph revision 1 lands.

   It also tests the receiver-blind index: 100% recall at 9% precision.
3. **Medusa, the third tree, with Gw items.** It meets all five criteria and its module isolation is the clearest in
   prose. But the graph sees almost none of its cross-module code (0–3% site recall). So it is the tree where the
   design predicts the graph arm ties or loses. It belongs in the bank as the negative control, unless DETECT-02 first
   gets units for factory callbacks (`createStep`/`createWorkflow` arguments).

**Not recommended.**
- Twenty, Immich, Unleash and Vendure: copyleft.
- Amplication and podkrepi-api: medium boundaries, unverified build, and smaller. Amplication is the reserve.
- Every v1.3 external repository: under 250 files.

**Before COMPREHEND-02 is designed** (development changes, for the author):
1. A caller query: `impact` on an interface listing the call sites of its members, which the index already holds.
2. Receiver typing on call edges to inherited members.
3. Units for callbacks passed to factories, and edges for calls to overloaded methods (resolved to the
   implementation, not to the first overload signature).
4. Graph revision 1 from the COMPREHEND-01 pilot (mapped and utility types in the write footprint).
5. An extractor edge for inline `import('…')` types.

Without items 1–3 the tools would be scored on what they cannot show, not on what the graph knows.

## 9. Limits

- **Sample size.** Three questions per tree; one hand check per tree. These are first readings, not estimates.
- **Who wrote the material.** A Claude session wrote the questions, the specs and the judgements of (c).
- **The specs are hand-written for the tools** (`experiments/repo-scout/specs/`). They give roles and contexts from
  each project's own declarations. Different specs would change `who_writes` and `context_map`, but not the index's
  call edges.
- **Program roots and path maps are this scout's.** Medusa's per-module path aliases (`@models`, `@services`, …,
  about 160 files) cannot be expressed in one program, so imports through them are unresolved in both the truth and
  the graph.
- **(a) is shown for Medusa (a subset of packages) and Backstage only.** Amplication and podkrepi-api were not built.
- **Twenty's no-deps type check** was stopped after 28 CPU minutes. For the four copyleft repositories only files,
  LOC, licence and boundary signals were recorded.
- **What the session wrote into the clones.** It wrote harness tsconfigs, `node_modules` and build outputs into the
  scratch clones only. Nothing was written into this repository's tree except `experiments/repo-scout/`, this report,
  the research log and the audit log.
