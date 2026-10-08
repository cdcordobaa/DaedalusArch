# U2 Extractor and Graph — Code Summary

> **Cycle**: v1.2 Evaluation-Readiness (lane 2) · **Unit**: U2 — Extractor and graph (C1 APG extractor, C2 Neo4j ingestion) · **Date**: 2026-10-08
> **Branch**: `v1.2e-u2-extractor-graph` (worktree `DaedalusArch-wt-u2`, off `origin/v1.2e` at `b692139`; U0 merged at `2050193`). Merges into `v1.2e` before U1 (ADR-015 item 12).
> **Plan**: `aidlc-docs/construction/plans/v1.2E-u2-extractor-graph-code-generation-plan.md`. Each step has a "Done" note with its commit, gate counts and deviations.
> **Binding design**: `aidlc-docs/construction/v1.2E-u2-extractor-graph/functional-design/` (`business-rules.md` BR-U2-01..47), ADR-015, ADR-016, `v1.2E-lane2-functional-design-clarifications.md`.

## Outcome

The extractor and the graph now carry what the evaluation reads: Package nodes and `File -[:IMPORTS]-> Package` edges, alias-aware import resolution, merged IMPORTS edges with their FR-10 properties, per-name barrel resolution with RE_EXPORTS edges, FLOWS_TO edges within the D8 scope, interface Method nodes with `Interface -[:CONTAINS]-> Method` (ADR-016 f), the six-field `importResolution` and per-type graph counts, Neo4j indexes, and a repository with a default timeout, a lazy driver, scrubbed errors and no password default.

**G0 holds (BR-U2-45).** No U2 commit touches `tests/golden/__snapshots__` or `tests/golden/CHANGES.md`. `GOLDEN_BASE` stays `f5fed3fbf1ba5ad84196b88dc80d474736534941`, and the five snapshot hashes (`U2_SNAPSHOT_HASHES`, sha256 prefixes) are unchanged at every step: correct-reference `2d1523d6`, variant-a `3c023649`, variant-b `9517a369`, variant-c `4d7ce596`, variant-d `69ad6a8f`. No template reads the new graph yet. Every snapshot delta it enables lands in the U1 or U3 commit whose query reads it (`business-rules.md` §9, G1–G8).

| Measure | Baseline (Step 2, `b692139`) | U2 exit (Step 20, `2d534af`) |
|---|---|---|
| `npm test` | 592 tests, 55 suites | 808 tests, 63 suites, 0 failures (+216) |
| `npm run typecheck`, `typecheck:u0-tests` | clean / clean | clean / clean |
| Gate L (lint, `eslint src tests`) | 624 errors / 4 warnings (87 files) | 624 errors / 3 warnings; per-file error counts unchanged; every new file 0 errors |
| Gate B (test type errors, scratch config) | 85, 0 `TS2688` | 85, per file identical, 0 `TS2688` |
| Golden suite (`GOLDEN_REQUIRED=1`, under the D-U2-7 lock) | 2 suites, 8 passed, 0 skipped | 3 suites, 17 passed (8 + `N_U2` = 9), 0 skipped |
| Gate G-CI | — | runs 37722232930 (Step 3), 37723907767 (Group 2), 37726212409 (Step 10), 37727700424 (Group 4), 37729670096 (Group 5), 37730804069 (Step 19): all success |

The Step 22 exit run re-measures these values on a clean `npm ci`; its Done note in the plan records the result.

## Commits (one per step)

| Step | Commit | Subject | `npm test` after |
|---|---|---|---|
| 0 | `b692139` | plan committed on `v1.2e` together with the U1 plan (deviation, see below) | 592 |
| 3 | `bc884fa` | `feat(u0-patch)`: `ImportResolutionStats.externalOutOfRootAlias`, `.droppedNoFileNode`, `ReExportEdgeProperties.isTypeOnly`, report schema | 593 |
| 4 | `77c23d1` | scout import probe and corpus output (ADR-016 h) | 593 |
| 5 | `8755248` | Package node factory, pinned built-in list, package and alias naming | 611 |
| 6 | `37a8e1a` | IMPORTS/RE_EXPORTS edge merger with the FR-10 merge rules | 625 |
| 7 | `637e2cc` | alias-aware module resolution, F-ALIAS fixture | 654 |
| 8 | `ca5e9d5` | per-name barrel resolution, RE_EXPORTS occurrences, dynamic import count | 681 |
| 9 | `8f15f98` | Package nodes, merged IMPORTS, RE_EXPORTS and import-resolution counts in `extractAPG` | 701 |
| 10 | `11e6c1c` | FR-10 acceptance snapshot on correct-reference, fixture import facts | 714 |
| 11 | `2158a25` | FLOWS_TO derivation within the D8 scope | 738 |
| 12 | `737e5c1` | interface Method nodes and `Interface -[:CONTAINS]-> Method` | 748 |
| 13 | `a93b53e` | repository default query timeout, lazy driver, no password default | 756 |
| 14 | `8495cbc` | scrubbed repository errors incl. resolved addresses, session-close warning | 776 |
| 15 | `5dd23e6` | node and edge properties written, per-type graph counts | 787 |
| 16 | `3d8ade2` | `ensureIndexes` for `APGNode` and `Package`, `INGEST_002`/`003` batch checks | 798 |
| 17 | `50b7ac6` | drift fan-out counts File targets only; Package annotation test | 801 |
| 18 | `a0c0615` | golden suite refuses short or snapshot-contained passwords | 808 |
| 19 | `3241447` | gated Neo4j acceptance `tests/golden/u2-ingestion.test.ts` | 808 (golden 17) |
| 20 | `2d534af` | corpus import-resolution rules; FR-21/FR-14 and design amendments | 808 |
| 21 | this commit | code summary | 808 |

Steps 1, 2 and 23 make no content commit (setup, baselines, merge).

## Files

**Created (C1)**: `src/apg-extractor/import-resolver.ts`, `import-edge-merger.ts`, `package-node-factory.ts`, `flows-to-deriver.ts`.

**Modified (C1)**: `src/apg-extractor/apg-extractor.ts`, `edge-extractor.ts`, `node-extractor.ts`, `types.ts`, `index.ts`. `id-generator.ts` unchanged.

**Modified (C2)**: `src/neo4j-ingestion/graph-ingester.ts`, `neo4j-ingestion.ts`, `neo4j-repository.ts`, `types.ts`, `drift-detector.ts`, `index.ts`; `fs-snapshot-store.ts` (Step 3 literal only). `layer-annotator.ts` unchanged (test only).

**Bundled U0 patch (Step 3, `bc884fa`, reviewed separately in the PR)**: `src/shared/types/apg.ts`, `schemas/report.schema.json`, and the literal updates in `src/apg-extractor/apg-extractor.ts`, `src/neo4j-ingestion/fs-snapshot-store.ts`, `tests/unit/neo4j-ingestion/delta-computer.test.ts`, `tests/unit/report/dashboard-data-builder.test.ts`, `tests/unit/report/graph-data-builder.test.ts`, `tests/unit/report/report-generator.test.ts`, `tests/unit/schemas/schemas.test.ts`, `tests/unit/shared/context/firewall-context.test.ts`.

**Tests created**: `tests/unit/apg-extractor/{package-node-factory,import-edge-merger,import-resolver,import-resolution-stats,extractor-correct-reference,flows-to-deriver,interface-contains}.test.ts`, the committed snapshot `tests/unit/apg-extractor/__snapshots__/extractor-correct-reference.test.ts.snap` (12 IMPORTS edges, no absolute path), `tests/unit/neo4j-ingestion/graph-ingester.test.ts`, `tests/golden/u2-ingestion.test.ts`.

**Tests modified**: `tests/unit/apg-extractor/edge-extractor.test.ts` (the `EXTRACTOR_001` case replaced by the BR-U2-02 case), `tests/unit/neo4j-ingestion/{neo4j-repository,neo4j-ingestion,drift-detector,layer-annotator}.test.ts`, `tests/unit/golden/golden-env.test.ts`, `tests/golden/golden-env.ts` (password guard, Q14 A), `tsconfig.u0-tests.json` (every new unit test file included, D-U2-6).

**Fixtures**: `fixtures/unit/u2-alias/**` (with the committed stub `node_modules/config/package.json`), `fixtures/unit/u2-alias-libs/x.ts`; `.gitignore` negation `!fixtures/unit/u2-alias/node_modules/` (S-5b). The five golden fixtures are untouched.

**Docs**: `Docs/DiagnosticRuns /u2-import-probe/{probe-imports.ts,README.md,output-2026-10-08.json,output-2026-10-08.md}` (D-U2-5, directory name quoted, not renamed); `Docs/corpus.md` ("Import resolution rules (U2)"); `aidlc-docs/inception/requirements/v1.2-evaluation-readiness-requirements.md` (FR-14, FR-21), `aidlc-docs/inception/application-design/v1.2E-component-methods.md`, `v1.2E-components.md` (clarifications §2.6); this file.

**Not touched** (checked by the Step 22 allow-list): every `src/` path outside `src/apg-extractor/**`, `src/neo4j-ingestion/**` and `src/shared/types/apg.ts`; the golden harness, `tests/golden/__snapshots__/**`, `tests/golden/CHANGES.md`; `.github/**`, `jest*.cjs`, `package.json`, `package-lock.json`; `fixtures/{correct-reference,variant-*}`, `specs/`, `presets/`. No new dependency (D-U2-4).

## Recorded values

### `N_U2` and per-fixture timings (Step 19, BR-U2-46, NFR-03)

`N_U2` = 9 (cases 1–4 one test each; case 5 one test per fixture). Gate G expects 8 + 9 = 17 from Step 19 on.

| Fixture | Local extract / ingest / total (ms) | CI run 37730804069 (ms) |
|---|---|---|
| correct-reference | 363 / 41 / 404 | 694 / 418 / 1112 |
| variant-a | 345 / 39 / 384 | 575 / 313 / 887 |
| variant-b | 365 / 38 / 403 | 555 / 227 / 782 |
| variant-c | 367 / 42 / 409 | 565 / 261 / 826 |
| variant-d | 353 / 51 / 404 | 559 / 245 / 803 |

All are below the 5 000 ms bound. These are the FR-18 inputs for Build and Test.

Read-back on the F-PKG temp project (case 3): `x.ts → express` (Package) `{line 1, lines [1], isTypeOnly false, specifier 'express', importedNames ['default']}`; `x.ts → y.ts` `{line 2, lines [2], isTypeOnly false, specifier './y', importedNames []}`. Variant-b `ITaskRepository -[:CONTAINS]->` Method count = 8.

### Fixture import facts (Step 10; equal to `business-logic-model.md` §6)

| Fixture | `external` | RE_EXPORTS | Other counters |
|---|---|---|---|
| correct-reference | 0 | 0 | `unresolved`, `droppedNoFileNode`, `unsupportedDynamic`, `externalOutOfRootAlias` all 0; `resolvedInternal` = static statement count − `external` |
| variant-a | 0 | 0 | same |
| variant-b | 1 | 0 | same |
| variant-c | 3 | 0 | same |
| variant-d | 0 | 1 (`TaskUtils.ts → InfraFormatters.ts`, `['formatDate']`, line 3, `isTypeOnly false`) | same |

Package nodes carry `filePath ''` and lie outside `mapped + unmapped`. Interface CONTAINS on `ITaskRepository` (Step 12): 5 / 4 / 8 / 9 / 4; CALLS unchanged at 2 / 1 / 4 / 2 / 2; Method nodes per fixture 12→23, 8→12, 12→20, 29→38, 9→13. FLOWS_TO (Step 11): correct-reference 0, variant-a 1 (`InMemoryTaskRepository → CircularHelper`, `helper`, `new`, line 8), variant-b 0, variant-c 1 (`→ CircularB`, line 7), variant-d 0.

### Probe comparison (Step 4, ADR-016 h)

The committed probe reproduces the FD figures 330; 1,159 (829 + 330); 396; 15; 166, and every FD Section 3 total. A re-run is byte-identical. Observations, none of which changes a decision (recorded in the probe README):
1. The `node_modules` vs unresolved-bare split differs in ghostfolio-api, truthy-demo, dry-run-test and realworld-test. The sums are equal, and truthy 23 and realworld 8 equal the JS-only resolutions (BR-U2-10/11).
2. The "20/16" nullable-union figure is not reproduced, because its counting rule was never recorded. Class instance fields with `| null`: dev-nest 0, dry-run-test 34. The FLOWS_TO limitation it supports is unchanged.
3. Built-ins that exist only with `node:` (`node:test`) must not be stripped to bare names (truthy `test/…` aliases).
4. U2 merge-key repeated pairs: 7, 4, 7, 7, 4.

## Decisions as executed (D-U2-1..11)

| # | As executed |
|---|---|
| D-U2-1 | Code, tests, fixtures, docs and design amendments committed on the unit branch in the worktree. **Deviation**: by the orchestrator's instruction, the plan checkboxes and Done notes were kept in the worktree copy of the plan, left uncommitted, so the unit branch still never commits `aidlc-docs/construction/plans/`, `aidlc-state.md` or `audit.md`. Step 24 carries the ticks into the main checkout. |
| D-U2-2 | `GOLDEN_BASE` `f5fed3f` and `U2_SNAPSHOT_HASHES` unchanged at every step; no snapshot regenerated, no `CHANGES.md` entry. |
| D-U2-3 | `ts.resolveModuleName` with the project's resolution host, used for relative specifiers too (Step 7 deviation, equivalent for project files). |
| D-U2-4 | No new package. |
| D-U2-5 | Probe in `Docs/DiagnosticRuns /u2-import-probe/` (quoted, not renamed), run with `npx tsx`. |
| D-U2-6 | Every new unit test file added to `tsconfig.u0-tests.json`; `tests/golden/u2-ingestion.test.ts` covered by the existing `tests/golden/**` include. |
| D-U2-7 | Every golden run held `$HOME/.daedalus-golden.lock`, with explicit `NEO4J_URI=bolt://localhost:7687`, `NEO4J_USER=neo4j` and `unset CI`. |
| D-U2-8 | Committed Jest snapshot `extractor-correct-reference.test.ts.snap`; `CI=1 npx jest --ci` passes with no snapshot written. |
| D-U2-9 | Step 3 was one `feat(u0-patch):` commit (10 files) and passed Gates T, U, L, B, G and G-CI on its own (run 37722232930). |
| D-U2-10 | PR into `v1.2e` with a merge commit, opened in Step 22 and merged in Step 23 under the standing approval. |
| D-U2-11 | FR-21 and FR-14 matched the text §2.6 quotes, so the stop rule was not triggered. Both were amended with the dated note. `origin/v1.2e` meanwhile gained ADR-017 (`8c3d6df`, FR-11/25/27 in the same file). `git merge-tree` showed no conflict, so the branch was not rebased. |

## Deviations from the plan (details in each step's Done note)

- Step 0: the plan was committed together with the U1 plan in `b692139`.
- Step 4: the probe output has supplementary columns beyond the FD columns.
- Step 5: `builtinRoot` returns a `PackageRoot`; `baseUrl` naming lives in a separate `packageRootFromBaseUrlSpecifier`; `packageRootFromSpecifier` returns `undefined` for roots that are not package-shaped.
- Step 6: the order of `specifiers` is associative only when sets are folded in line order (content is always equal). `ImportEdgeMerger.edges()` is exact.
- Step 7: relative specifiers go through `ts.resolveModuleName`; `resolveModule` takes `{ warnUnresolved: false }` for S-9a hops; the context carries `project` and `host`.
- Step 8: the barrel loop check keys on the alias declaration, not `(file, name)`. `export *` hops are neither counted nor classified. The resolvers return `{ occurrences, outcome, outOfRootAlias }`.
- Step 9: `extractEdges` with no source files returns zero counts (unreachable through `extractAPG`).
- Step 11: `deriveFlowsToEdges` uses the `component-methods.md:687` five-argument signature.
- Step 17 (interpretation, no code change): `annotateNodes` stores the all-null entry for Package nodes, read as "no annotation".
- Step 19: the read-back projects Package targets by `name`, because their `filePath` is `''`.
- Step 21 (this summary): the Step 21 Verify line names the main checkout copy of the plan. Under the D-U2-1 deviation above, the check was made on the worktree copy (Steps 0–20 ticked).

## Hand-offs (`business-rules.md` §10)

| To | Hand-off | Owner |
|---|---|---|
| U1 | `no-orphan-files`: universal orphan predicate (`:File` typing, `IMPORTS\|RE_EXPORTS` both directions, `NOT f.isBarrel`) plus the existing `f.layer IS NOT NULL` (ADR-016 g) | U1 |
| U1 | `dependency-direction`, `no-layer-skip`, `no-domain-outward-dep` traverse `IMPORTS\|RE_EXPORTS`, return `type(i) AS relType` and `coalesce(i.isTypeOnly, false) AS isTypeOnly`; cycle query traverses both, rows carry `cycle`, `target`, `line` only (U1 BR-U1-28) | U1 |
| U1 | Bounded cycle query (literal bound 10) before any corpus baseline (ADR-015 item 5) | U1 |
| U1 | Interface→Method `CONTAINS` is now provided, so FF-SO02 can fire. The BR-U1-39 exclusion applies only if BR-U2-47 acceptance fails at FR-18 (it passed at Step 19: variant-b count 8) | U1 |
| U3 | `getNum` failure propagation; universal cycle metric uses the same bound; ADR-015 item 5 latency gate on ghostfolio (30 s, ADR-016 e), Tarjan SCC fallback | U3 |
| U3 | Universal orphan metric: the same predicate, **no layer filter** (ADR-013, ADR-016 g) | U3 |
| U3 | `domain-state-purity` matches `[:FLOWS_TO\|CONSTRUCTOR_INJECTS]` (BR-U2-30) | U3 |
| U3 | FR-11 `domain-purity` follows `IMPORTS\|RE_EXPORTS` (now also ADR-017 item 5) | U3 |
| U3 | Route extractor warnings (`EXTRACTOR_002`, `006`–`009`) into `report.warnings` as its own attributed snapshot change (FR-13; Q15 A) | U3 |
| U3 | Fill and report all six `importResolution` fields, `externalOutOfRootAlias` next to `external`; freeze the schema (D-U0-2) | U3 |
| U3 | `i.line` is a Float in Neo4j: compare as a number | U3 |
| U3 | Remove the `'neo4j'` password fallbacks (`cli.ts:86,323,394`, `batch-runner.ts:49`, `drift-handler.ts:104`) (D-U0-8) | U3 |
| S1/U3 | `new Neo4jRepository(...)` (`pipeline-factory.ts:66`) no longer throws on a bad URI; the failure surfaces at the first query (Q13 A) | S1/U3 |
| Build and Test | Per-project alias-name listing in `Docs/corpus.md` after the corpus-run freeze (BR-U2-06); FR-18 timings above | Build and Test |

## Residual findings (recorded, not fixed)

From `business-rules.md` §12:
- `saveSnapshot` runs before `getLatestSnapshot` (`neo4j-ingestion.ts`).
- Drift reads `n.properties['layer']` (`drift-detector.ts`).
- `loadSnapshot` returns a zero `importResolution` (`fs-snapshot-store.ts`).
- The parent lookup in `layer-annotator.ts` is O(N·F).
- `decorators` are never written to Neo4j, so `naming-controllers` cannot match (needs its own FR).
- Duplicate node ids from TypeScript declaration merging are not detected before ingestion. `INGEST_002` would show them as "created n of m" with n > m.

Added during code generation:
- **Behaviour outside the golden suite** (risk R13): the dashboard totals `apgNodes` / `apgEdges` (`dashboard-data-builder.ts:97-98`, from `apgResult.nodes/edges.length`) now count Package nodes, interface Method nodes and the new IMPORTS-to-Package, RE_EXPORTS, FLOWS_TO and CONTAINS edges. The HTML dependency graph is unchanged, because `graph-data-builder.ts:79,94` keeps File nodes and File-to-File IMPORTS only. No golden snapshot covers these views, and their presentation belongs to U3.
- `tests/features/apg-extractor/import-resolution.feature:18` still describes the retired `EXTRACTOR_001` scenario. It has no step definitions and is not executed.
- Indexes `apg_node_id` and `package_id` now persist in the local 7687 database. This is expected, because `ensureIndexes` is idempotent.

## Security Baseline compliance (`business-rules.md` §13)

| Rule | Status | Evidence |
|---|---|---|
| SECURITY-03 Application logging | Compliant | Repository errors scrubbed, including resolved addresses (S-1, BR-U2-39..42, Step 14). Close-failure warning scrubbed (BR-U2-40). Extractor warnings carry specifiers, never absolute paths (BR-U2-13). No password default (BR-U2-44). Golden guard refuses weak or snapshot-contained passwords (BR-U2-43). Gate P 0 at every commit. |
| SECURITY-05 Input validation | Compliant | All values go in as Cypher parameters. The only interpolated tokens are labels from `NODE_TYPES` / `EDGE_TYPES`. |
| SECURITY-09 Hardening | Compliant (U2 part) | `'password'` default removed from `neo4j-ingestion/types.ts`; `grep -n "'password'" src/neo4j-ingestion` is empty. The CLI fallbacks are U3's. |
| SECURITY-15 Exception handling | Compliant | Every repository path, including driver construction and session close, returns a `DomainResult` instead of throwing (BR-U2-40, 41). |
| SECURITY-01, 02, 04, 06, 07, 08, 10, 11, 12, 13, 14 | N/A | U2 adds no store, endpoint, network, IAM, authentication, deserialisation or alerting surface. SECURITY-10: no new package, lock file unchanged. SECURITY-11 (ADR-017 item 8) concerns the U4 generator, not U2. |

## NFR-04 inputs for Build and Test

- Graph contract delivered (`domain-entities.md` §5): `:Package {name, scope}`; `[:IMPORTS {specifier, specifiers, line, lines, isTypeOnly, importedNames}]`; `[:RE_EXPORTS {…, exportedNames}]`; `[:FLOWS_TO {field, via, line}]`; `[:CONSTRUCTOR_INJECTS {parameterName, decoratorBased}]`; `[:CALLS {callCount}]`; `Interface -[:CONTAINS]-> Method`; `GraphStats.nodeCountByType` / `edgeCountByType`; `APGResult.importResolution` (six fields); warnings `EXTRACTOR_002`, `006`, `007`, `008`, `009` (not routed, Q15 A).
- Repository contract: default timeout 30 000 ms (writes 120 000 ms), scrubbed failures, lazy driver, `REPO_SESSION_CLOSE_FAILED`.
- Neo4j schema: labels `APGNode` plus the node type; indexes `apg_node_id` (`:APGNode(id)`) and `package_id` (`:Package(id)`), followed by `db.awaitIndexes()`.
