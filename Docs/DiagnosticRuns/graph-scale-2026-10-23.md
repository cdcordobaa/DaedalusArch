# GRAPH-SCALE: the DETECT-02 graph facts complete and precise at scale (U1 groundwork)

**Run:** 2026-10-23 (UTC), about 03:50–05:00, in a cloud sandbox.
**Status:** exploratory, **v1.5-exp**, development material. **Zero model calls.**
**Unit:** v1.5 U1 groundwork (FR-1), plan `aidlc-docs/construction/v1.5/u1-graph-scale-plan.md`, under the author's
standing delegation for gate-level calls.
**Code and records:** fixes in `experiments/detect-02/`; measurement in `experiments/graph-scale/` (`results/`).
**Not changed:** `src/`, `presets/`, `scripts/lib/`, `scripts/v1.3/`, the tag `v1.4-freeze-2026-10-20`, every
registered Study 2b artefact, and the scout's truth (`experiments/repo-scout/truth.ts`). The extractor and the
fidelity library were imported read-only. No third-party source is committed. Clones lived in a scratch directory at
the scout's pins: Backstage `d72327203d5d`, Novu `894d63ff5252`, Medusa `6cc1a4acab6d`.

## 1. Result in one paragraph

All five fixes work at scale, and none changes the DETECT-02 rules' results.
- **Medusa**, the scout's blind tree: the index had 0–17% of the call sites on its caller and writer questions, and
  `who_writes` refused them. Now `callers` and `who_writes` give **100% site recall at 100% precision** on every one. Its cross-module question (MD-X1) went from 1% to
  **100% / 100%** in the index.
- **Novu's** inherited repository writes are now told apart by receiver: `callers` and `who_writes` give 100% recall
  at 95–100% precision. The receiver-blind index gave 9%.
- **`who_writes`** answers on all three trees. It was empty or an error on every writer question before.
- **Backstage's** tsc coverage in the literal view is **1.000** (was 0.995): the 26 inline `import('./X').X` edges
  are found.

The remaining misses are few:
- **BS-C3** (94%): 2 calls of a base-interface member on a base-typed receiver, left out by the rule set before
  measuring.
- **BS-W2** (86%): 2 `claimTask` calls, whose name and shape do not say "write".
- **NV-W2 under the scout's truth** (26% recall): the truth itself over-counts there (§4, revision R1). Against the
  receiver-checked truth, `callers` is 100% / 100%.

## 2. What was changed

The fixes are in the comprehension index and tools. The rules still read `lib/facts.ts`, which is not edited.

| Fix | What | Where |
|---|---|---|
| (a) factory and callback units | A module-level `const x = factory(…, () => …)` becomes the unit `x`: a step, a workflow, a registry or provider factory, or any call chain passing a function literal. A class property initialised the same way becomes a unit too. The callbacks' calls belong to `x`, and a call to `x(…)` resolves to it. | `mcp/comprehend/index.ts` (`factoryCall`) |
| (b) receiver-aware calls | Every call to an in-tree class or interface member is kept (`memberCalls`), with its declaring owner and the receiver's static type from the checker. Edges carry `receiver` when the member is declared on a base type. A call to an overloaded method resolves to the declaration with a body. | `index.ts` |
| (c) `callers(port_or_method)` | Lists every call site of a type's members (`Type`, `Type.member`, `file#Type`), grouped by unit. A site counts if it is through the port (`port`), through a class or interface that implements or extends it (`implementation`), or through a member it inherits, but only when the receiver is the type or a subtype (`inherited`). It also lists the implementations. Served by the comprehension MCP server with `withCallers` / `--with-callers`. Without that flag the server keeps the COMPREHEND-01 arm's four tools. | `tools.ts` (`callers`, `callerSites`), `comprehend-server.ts` |
| (d) inferred entities, `who_writes` | Entity-like types are found from four kinds of evidence: an ORM decorator (`@Entity`, `@Table`, `@Schema`, `@Model`, `@Document`); a schema definition (`model.define("Product", …)`, `mongoose.model("X", …)`); the identity-bearing type argument of a generic base repository; or a store that loads the type by identity. Each entity's stores are those repositories, plus store or service types with a member named `<verb><Entity>`. A store member writes when its name starts with a mutation verb, or when it returns nothing and takes an argument. `who_writes` keeps the footprint answer when there is one. Otherwise it lists the units calling a write member of the entity's stores, with the same receiver rule. Every entity carries its evidence; one the spec does not name is `inferred`. | `entities.ts`, `tools.ts` (`whoWrites`, `entityWriteSites`) |
| (e) inline import types | Every `import('…')` type node with a literal argument is resolved with the compiler's module resolution. The edges join the index's import graph (`impact` importers), and the coverage add-on adds them to the frozen extraction. | `lib/import-types.ts`, `index.ts`, `experiments/graph-scale/coverage.ts` |

**Unit tests.** `graph-scale.test.ts` has 18 tests on a committed fixture tree
(`experiments/detect-02/fixtures/graph-scale/tree`), with one instance of each construct. `tools.test.ts` has 16
tests: the 15 before, plus one for the `callers` tool through the MCP layer.

## 3. Regression (DETECT-02 material)

The baseline was taken on the base commit `4d800850` before any change, and re-run after the fixes
(`experiments/graph-scale/results/regression.json`).

| Material | Before | After |
|---|---|---|
| Dev set, 91 trees (puzzles, HEXDDD-01 step trees rebuilt from seeds and diffs, DETECT-01 fixtures) | D4 33/0/0, D5 11/0/5, D9 3/0/0, H5 4/0/0, H4 0/0/0, RTX 0/0/0 (TP/FP/FN) | **identical, tree by tree** (only timings differ); identical to the committed `results/dev.json` |
| Precision fixtures, 10 patterns × declared/fallback | 0 of 20 legit runs flagged, 12/12 positives | **identical** |
| Tool tests | 15/15 | 16/16, plus 18/18 new |

## 4. Method

**Truth.** The scout's `truth.ts`, unchanged: find-all-references on the members of a port through the ts-morph
language service, grouped by the enclosing named unit.
- **The scout's 9 questions** are `experiments/repo-scout/questions/`.
- **9 new questions** are `experiments/graph-scale/questions/`, three per tree: callers of a port and writers of an
  entity. They were committed before any fix was written (`2414228b`):
  - BS-C2 `SchedulerService`, BS-C3 `PermissionsService`, BS-W2 scaffolder tasks through `TaskStore`;
  - NV-C2 `ICacheService`, NV-W2 integrations and NV-W3 messages, both through their repositories;
  - MD-C2 `IPricingModuleService`, MD-W2 orders and MD-W3 customers, both through their module services.

**Environment.**
- Backstage and Novu use the scout's harness tsconfigs, without dependencies.
- Medusa uses the scout's state: `yarn install --mode=skip-build`, then its own `turbo run build` for the product
  module and core-flows (13/13 tasks).
- Without that build, Medusa's MD-C1 truth drops from 33 to 22 sites. With it, the before run reproduces **every one
  of the scout's 9 numbers exactly** (`experiments/repo-scout/results/compare-*.json`).

**Before and after.** The same harness ran on both versions: `experiments/graph-scale/compare.ts`, copied into a
worktree of `4d800850` for the before run. A tool the base commit lacks is `n/a`.

**Grains.** Recall and precision are computed at call sites, units and files, uncapped.
- "Index" is the scout's matcher, with resolved edges only. That is the scout report's "Index" column; its lenient
  form, with unresolved calls, is in the JSON.
- `callers` is restricted to the question's member list.
- `who_writes` is its uncapped writer list.
- Unit ids are compared without the index's `@line` suffix for duplicate names, in both runs.

**Freeze, and one revision.** The fixes were committed and pushed (`143f77a0`) before the first after-measurement
(M1, kept in `results/m1/`). After M1, no fix changed. One harness revision was made.

**Truth revision R1 (2026-10-23, after M1, harness only).** NV-W2's truth held 136 sites; reading them showed 100 of
them are `feedRepository.create`, `subscriberRepository.delete` and the like.
- Why: find-all-references on a member that a class *overrides* (`IntegrationRepository.create`) also returns every
  call of the base member, and the scout's receiver check covered inherited members only.
- What R1 does: a site of a class question is kept only when a call of that member on that line has a receiver typed
  by the class or a subclass. The check is the scout's own `receiverIs`, the compiler's type of the receiver.
- R1 is reported beside the unchanged truth. It changes only NV-W2 (136 → 36 sites); NV-W1 and NV-W3 keep all their
  sites, and interface questions are not touched.
- Every tree was re-measured with R1 (M2, `results/before-*.json`, `results/after-*.json`). M2's numbers equal M1's
  wherever both exist.

## 5. Before and after, per repository and tool

Cells are recall / precision at call sites. "error" means the tool refused the question ("unknown aggregate"); "–"
means not asked. The `callers` tool does not exist before (n/a). Unit and file grains are in
`experiments/graph-scale/results/tables.md`.

### Backstage (truth from the language service; 2,229 files)

| Item | Truth sites / units / files | Index (before → after) | `callers` (after) | `who_writes` (before → after) | `impact` command files (before → after) |
|---|---|---|---|---|---|
| BS-W1 `ProcessingDatabase` writes | 4 / 1 / 1 | 100 / 100 → 100 / 100 | 100 / 100 | – | 0 / 0 → 0 / 0 |
| BS-C1 `CatalogService` callers | 39 / 31 / 29 | 100 / 100 → 100 / 100 | 100 / 100 | – | 0 / – → 0 / – |
| BS-X1 scaffolder → catalog | 19 / 6 / 5 | 95 / 100 → 95 / 100 | – | – | – |
| BS-C2 `SchedulerService` callers (new) | 32 / 31 / 29 | 100 / 100 → 100 / 100 | 100 / 100 | – | 0 / – → 0 / – |
| BS-C3 `PermissionsService` callers (new) | 35 / 31 / 16 | 94 / 100 → 94 / 100 | 94 / 100 | – | 0 / – → 0 / – |
| BS-W2 `TaskStore` writes (new) | 14 / 13 / 3 | 100 / 100 → 100 / 100 | 100 / 100 | error → **86 / 100** | 0 / – → 0 / – |

### Novu (3,231 files)

| Item | Truth | Index (before → after) | `callers` (after) | `who_writes` (before → after) | `impact` command files |
|---|---|---|---|---|---|
| NV-W1 subscriber writes | 20 / 20 / 18 | 100 / 9 → 100 / 9 | **100 / 100** | 0 / – → **100 / 95** | 17 / 13 → 17 / 13 |
| NV-C1 `IAuthService` callers | 31 / 30 / 17 | 100 / 100 → 100 / 100 | 100 / 100 | – | 41 / 100 → 41 / 100 |
| NV-X1 subscribers-v2 → other modules | 108 / 40 / 9 | 87 / 100 → 87 / 100 | – | – | – |
| NV-C2 `ICacheService` callers (new) | 118 / 74 / 28 | 100 / 100 → 100 / 100 | 100 / 100 | – | 0 / – → 0 / – |
| NV-W2 integration writes (new), scout truth | 136 / 105 / 90 | 96 / 54 → 96 / 54 | 26 / 100 | error → 26 / 90 | 1 / 8 → 1 / 8 |
| NV-W2, truth R1 | 36 / 30 / 24 | 100 / 15 → 100 / 15 | **100 / 100** | error → **100 / 90** | – |
| NV-W3 message writes (new) | 19 / 17 / 9 | 100 / 8 → 100 / 8 | **100 / 100** | error → **100 / 63** | 0 / 0 → 0 / 0 |

### Medusa (2,815 files)

| Item | Truth | Index (before → after) | `callers` (after) | `who_writes` (before → after) | `impact` command files |
|---|---|---|---|---|---|
| MD-W1 product writes | 10 / 5 / 5 | 0 / – → 70 / 100 | **100 / 100** | error → **100 / 100** | 20 / 100 → 20 / 100 |
| MD-C1 `IInventoryService` callers | 33 / 15 / 15 | 3 / 100 → 64 / 100 | **100 / 100** | – | 7 / 100 → 7 / 100 |
| MD-X1 order flows → other domains | 323 / 94 / 93 | 1 / 100 → **100 / 100** | – | – | – |
| MD-C2 `IPricingModuleService` callers (new) | 46 / 24 / 18 | 15 / 100 → 65 / 100 | **100 / 100** | – | 0 / – → 0 / – |
| MD-W2 order writes (new) | 12 / 8 / 8 | 0 / – → 100 / 100 | **100 / 100** | error → **100 / 100** | 0 / – → 0 / – |
| MD-W3 customer writes (new) | 8 / 4 / 4 | 0 / – → 50 / 100 | **100 / 100** | error → **100 / 100** | 0 / – → 0 / – |

**Facts behind the tools.**

| Tree | Units | Call edges | Member calls (new) | Inferred entities (new) | Import-type edges (new) |
|---|---|---|---|---|---|
| Backstage | 5,929 → 5,955 | 12,798 → 12,958 | 6,179 | 5 | 27 |
| Novu | 7,889 → 7,901 | 14,206 → 14,860 | 9,093 | 45 | 0 |
| Medusa | 3,499 → **4,312** | 6,618 → **10,978** | 5,802 | 109 | 0 |

**Coverage against tsc** (literal view, edges scoped to APG files; `results/coverage-*.json`).

| Tree | Before | After | Misses before → after |
|---|---|---|---|
| Backstage | 0.9951 (5,270 / 5,296) | **1.0000** (5,296 / 5,296) | 26 → 0 |
| Novu | 1.0000 | 1.0000 | 0 → 0 |
| Medusa | 1.0000 | 1.0000 | 0 → 0 |

Confirmation (APG edges that tsc also has) stays 1.000 everywhere.

**Extraction and index time.** The two runs (before and after) ran in parallel, two heavy processes at a time.

| Tree | `extractAPG` (v1.3 defaults) | Import-type add-on | Index build, before → after | Peak RSS, before → after |
|---|---|---|---|---|
| Backstage | 9.8 s | 0.21 s | 73.0 s → 75.4 s | 4.9 → 5.0 GB |
| Novu | 15.9 s | 0.23 s | 94.4 s → 81.9 s | 4.6 → 4.2 GB |
| Medusa | 15.0 s | 0.12 s | 113.7 s → 108.2 s | 5.9 → 5.9 GB |

The fixes cost no measurable build time: the differences are within the run-to-run spread of parallel runs. Every
`callers` answer took at most 42 ms on a built index.

## 6. What the remaining misses and extra rows are

1. **BS-C3, 2 sites.** `ServerPermissionClient.authorize` calls `this.permissionClient.authorize`, where the receiver
   is typed `PermissionEvaluator`, the base interface. The truth counts every reference to the base member. `callers`
   counts an inherited member only on a receiver typed by the port or a subtype. That rule was fixed before measuring.
   It is a definition, and the other one is defensible; a flag could serve both.
2. **BS-W2, 2 `who_writes` sites (86%).** Both are `claimTask` calls. `claimTask` returns the claimed task, and its
   name has no mutation verb, so it is not a "write member". `callers` on `TaskStore`, given the question's members,
   finds both.
3. **NV-W1, 1 extra `who_writes` row (95%).** `TopicSubscribersRepository.removeSubscribers` writes topic
   subscriptions, another collection. The repository is listed as a store of `SubscriberEntity` because a member is
   named after it (`removeSubscribers`). That is the name rule's known risk.
4. **NV-W3, 11 extra `who_writes` rows (63%) and NV-W2's 4 (90%).** They are calls to the repositories' own write
   methods (`updateMessageStatus`, `markAllMessagesAs`, `deleteMessagesByIds`, …). These write messages, but the
   question's member list names only the base-repository members. They are real writes outside the question, not
   graph errors. `callers` restricted to the question's members is 100% / 100%.
5. **Index precision on Novu's writer questions (8–15%).** The scout's index matcher still matches by callee owner.
   The receiver-aware view of the same index is `callers`.
6. **The index's resolved edges on Medusa's callers (64–70%).** An edge needs a target unit. Calls on an interface
   member with no in-tree implementation (Medusa's `container.resolve<IXModuleService>` in steps) have no edge.
   `memberCalls`, which `callers` reads, holds them all.
7. **`impact` is unchanged.** Its "commands reaching" starts from application-layer commands, and these trees declare
   few of them. `callers` is the tool for "who is affected by this port". `impact` was not changed in this round.
8. **NV-X1 (87%) and BS-X1 (95%) are unchanged.** The misses are decorators and class-level initialisers outside any
   unit (the scout's item 3), not in this round's list.

## 7. Reading (dev)

- On these three trees, at the scout's pins, **the comprehension graph is now complete and precise wherever the
  compiler can resolve the call**, including functional composition (Medusa) and generic base repositories (Novu).
  The scout's Gw ("graph known wrong") labels for Medusa and for Novu's writer questions no longer hold, as far as
  this test shows.
- **Write facts no longer need declared aggregates.** Inferred entities carry their evidence and the label
  `inferred`. Their store rules (a mutation verb, a command shape, a member named after the entity) are heuristics:
  they over-include a repository's own extra write methods and miss a write without a verb (`claimTask`). An agent
  should read `who_writes` as "units writing through the stores", and use `callers` for an exact member list.
- **The truth needed a correction.** References to an overriding member include the base member's calls. Any later
  use of `truth.ts` on class ports should apply R1.
- These are 18 questions written by a Claude session, on development material. The fixes were written while looking
  at the scout's misses, but not at the 9 new questions, which were committed first.

## 8. Limits

- **One environment.** Medusa built as the scout built it; Backstage and Novu used harness tsconfigs without
  dependencies, as the scout did. Calls through `any` or string-keyed containers are in neither the truth nor the
  graph.
- **The new questions** cover callers and writers only. Cross-module questions were not added.
- **The heuristics in (d)** (the verb list, the command shape, the name rule) were set before the measurement and not
  tuned after it. A different verb list would change BS-W2 and NV-W1.
- **Factory units (a)** cover module-level declarations and class properties. A factory call that is not assigned (a
  bare `registry.register("x", () => …)` at module level) is still outside any unit.

## 9. Reproduce

See `experiments/graph-scale/README.md`: clone at the pins, write the harness tsconfigs, install and build Medusa,
then run `compare.ts` on each tree (and in a worktree of `4d800850` for before), `coverage.ts`, and `table.mjs`.
Regression: `evaluate.ts --dev --pilot-trees <rebuilt HEXDDD-01 trees>` and `precision.ts`.
