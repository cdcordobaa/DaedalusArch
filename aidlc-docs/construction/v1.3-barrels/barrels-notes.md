# v1.3 barrels unit: literal + resolved re-export edges (ADR-V13-01)

Branch `v1.3-barrels`, cut from `origin/v1.3` @ `513e5583`. The decision is ADR-V13-01 (`Docs/v1.3/adr-v13.md` on `v1.2e`, option A). The defect it fixes was found by PR #81 (graph fidelity) and PR #83 (DDD, probe E1, mismatches M1 and M2).

## 1. Extractor

New option `ExtractorOptions.reExportEdges: 'resolved-only' | 'both'`:

| Constant | `reExportEdges` |
|---|---|
| `V12E_DEFAULT_OPTIONS` | `'resolved-only'`: the v1.2E behaviour (BR-U2-24 per-name routing to the declaring file) |
| `V13_DEFAULT_OPTIONS` (= `DEFAULT_OPTIONS`) | `'both'` |

With `'both'`, an import statement whose specifier resolves to a project file M (the barrel) gives:

- one **literal** IMPORTS occurrence to M, carrying every name of the statement. It is marked `reExportHop: true` when no name is declared in M, so `'resolved-only'` would have no edge to M;
- one **resolved** occurrence per other target the names route to (a declaring file or a Package), marked `viaReExport: true`, with `reExportBarrels`: the re-export files crossed, import side first.

The merger keeps a mark only when every occurrence on the edge has it. A direct import of the declaring file therefore unmarks the edge, so both views keep it.

Barrel path. The files of the alias declarations that `followExportedName` crosses are collected; collecting them does not change the result. The checker resolves an `export *` name straight to its declaration, which would skip the intermediate files. These are filled in by a breadth-first search over `export … from` targets, with a visited set and the `maxBarrelDepth` bound. Re-export cycles:

- **Named cycle** (`c → d → c`): the existing `EXTRACTOR_007` guard fires and the import falls back to M, so only the literal edge is emitted.
- **`export *` cycle** (`a ↔ b`): the checker resolves it, and the breadth-first search terminates on its visited set.

What does not change between the modes:

- nodes, warnings and parse coverage;
- the statement partition counters (the outcome is computed from the resolved-only occurrences);
- RE_EXPORTS and dynamic-import edges.

Files: `src/apg-extractor/{types,import-resolver,import-edge-merger,index}.ts`, `src/shared/types/apg.ts` (three optional properties).

### v1.2E byte-identity

The full `APGResult` JSON was hashed with `V12E_DEFAULT_OPTIONS` on a checkout of `origin/v1.3` and on this branch, for all 15 fixture projects in the repo (the 5 golden fixtures, the 7 `fixtures/unit/*`, `tests/fixtures/{hexagonal/clean,hexagonal/violating,u5a/no-domain}`, and the new fixture). All 15 hashes are **identical**.

Under the v1.3 defaults, only the new `fixtures/unit/v13-barrels` changes. No other fixture has an import that hops a barrel, so the golden suite's graphs are the same in both modes. The new test asserts this for the five golden fixtures.

## 2. Edge views per template

The views were recorded in `Docs/v1.3/edge-views.md`, committed (`2bedc6be`) **before** any validation was run. The table:

- **literal (13):**
  - frozen: dependency-direction, no-cyclic-deps, no-layer-skip, no-domain-outward-dep, the four coupling metrics, no-orphan-files;
  - hexagonal: dependency-direction-graph, layer-skip-graph, core-isolation;
  - DDD: context-isolation.
- **resolved (4):** domain-purity, controller-no-entity, aggregate-boundary, repository-aggregate-root.
- **none (21):** the templates that read no IMPORTS edge, including the module-wiring template (MODULE_IMPORTS).

How it runs:

- `CompileOptions.edgeViews` (with `V13_COMPILE_OPTIONS = { edgeViews: true }`) makes `applyEdgeView` (`src/fitness-compiler/edge-views.ts`) rewrite the compiled query of each template, chosen by template id. Fixed-length IMPORTS patterns get an inline `WHERE`. Variable-length ones are bound to a list and filtered in the next `WHERE`. The frozen template text is not edited.
- `compileFunctions` without the option compiles exactly as before (asserted for 5 specs/presets).
- The pipeline's `CompileCommand` and `validate --rules v1.3` pass the option, because the pipeline extracts with the v1.3 defaults. On a v1.2E graph the predicates are always true. The Neo4j test checks that on both specs: every template gives the same rows rewritten and frozen.
- The hexagonal compiler path takes the option too.

**DDD.** When the table was written, the DDD templates were not on `v1.3` (PR #83). Their views were recorded from the rule definitions. `v1.3` then merged #83 (with #81 and #82), and this branch merged `origin/v1.3` @ `5d50dfaf`. The only conflict was the import block of `fitness-compiler.ts`. `ddd-compiler.ts` now calls `applyEdgeView` when `edgeViews` is set, in the same way as `hexagonal-compiler.ts`. No view was changed.

Effect on the DDD reference test: the expected-graph key edge E1 (`billing/acl/OrderingAcl.ts -> ordering/index.ts`) is now extracted, as a literal `reExportHop` edge. The resolved edge to `ordering/contracts/OrderSummary.ts` is there too, with `viaReExport` and barrel `src/ordering/index.ts`. `ddd-reference.test.ts` recorded E1 as a known mismatch that must fail when the tool changes. It now records no mismatch and asserts both edges. The findings manifests (and M2, M3) are unchanged. The fixtures and manifests were not touched.

`context-isolation` still carries the M1 workaround. Under the literal view the barrel edge is in the graph, so M2 can be closed by a template change (outside this unit).

## 3. Tests

The new fixture `fixtures/unit/v13-barrels` covers these cases:

- the order-fulfilment shape;
- `export *` (single hop and through a barrel chain);
- a named multi-hop chain;
- type-only and aliased re-exports;
- a barrel that also declares a name;
- a direct import plus a barrel import of the same file;
- an `export *` cycle and a named cycle.

| Suite | Tests |
|---|---|
| `tests/unit/apg-extractor/v13-reexport-edges.test.ts` (new) | 26. Both edges in v1.3, only the resolved edge in v1.2E, barrel paths per shape, cycles, resolved view = v1.2E edge set, golden fixtures unchanged by the option, the real E1 cell (read-only, skipped if absent) |
| `tests/unit/fitness-compiler/v13-edge-views.test.ts` (new) | 23. Every template of the four catalogues (frozen, hexagonal, module-wiring, DDD) has a view, and the table has no other entry; `none` exactly when no IMPORTS is read; the table equals the doc; the rewrite is exact and deterministic; the frozen text is unchanged without the option |
| `tests/unit/fitness-compiler/v13-edge-views-neo4j.test.ts` (new) | 5, on Neo4j (golden guard, skips without `NEO4J_PASSWORD`). The rewritten Cypher runs; it is a no-op on the v1.2E graph; resolved-view rows on the v1.3 graph equal the v1.2E rows; `no-layer-skip` (layered preset moved onto the fixture) reports the order-fulfilment file's three skips to domain in v1.2E and none in v1.3, keeps the direct deep import, and reports `star.ts → domain/index.ts` |

Adapted existing tests. Each one pins v1.2E behaviour and now passes the frozen mode explicitly:

- `import-resolver.test.ts` (harness default `reExportEdges: 'resolved-only'`);
- `import-resolution-stats.test.ts` (`V12E_FLAGS`);
- `graph-mode-ast-only.test.ts`;
- `compiler-input.test.ts`: `CompileCommand` now equals `compileFunctions(…, V13_COMPILE_OPTIONS)`;
- `tests/unit/scripts/v1.3/graph-fidelity.test.ts` (from #81): its "v1.2E extractor" case passes `V12E_DEFAULT_OPTIONS`, because `{}` means the v1.3 defaults on this branch;
- `tests/unit/ddd/ddd-reference.test.ts`: the recorded mismatch E1 is closed (see §2).

Runs, all with `--maxWorkers=2`, Neo4j `daedalus-neo4j-bt` on bolt 7693, credentials from `~/.daedalus-bt.env` (never printed):

| Run | Result |
|---|---|
| extractor (unit and integration), fitness-compiler, the fidelity harness tests, the touched pipeline / CLI-validate tests, hexagonal and DDD (including both Neo4j suites), after merging `origin/v1.3` @ `5d50dfaf` | 58 suites, **968 passed**, 0 failed, 0 skipped |
| the same set before that merge | 52 suites, 783 passed |
| golden lane (`jest.golden.config.cjs`, `GOLDEN_REQUIRED=1`, `--runInBand`) | 7 suites, **81 passed** |
| `--check-prereg` on all 12 plans | `pre-registration v25 ok: 85 registered artefacts unchanged` |

The machine's memory hook blocked on swap while `memory_pressure` reported 33–34 % free. Heavy commands were therefore run with `HEAVY_ADMISSION_BYPASS=1`, as permitted.

## 4. Graph fidelity on the two disagreeing E1 cells

The harness from `origin/v1.3-fidelity` was merged into this branch. It gained a `--views` flag that adds `apg-v13-literal` (no `viaReExport` edges) and `apg-v13-resolved` (no `reExportHop` edges). `apg-v12e-default` now passes `V12E_DEFAULT_OPTIONS` explicitly. Command: project mode with `specs/clean-arch.yaml` and the pinned per-run tsconfig (ADR-032). The cells were only read. Outputs are in `results/v1.3-barrels/fidelity/`.

dependency-cruiser and tsc agree exactly on both cells, so one row covers both. Columns: refCoveredByApg / apgConfirmedByRef / Jaccard (|A∩R|, |A|, |R|).

| Cell | Before: v1.2E (= PR #81) | After: v1.3 literal | v1.3 resolved |
|---|---|---|---|
| claude-opus-5-5/task-management/none/run-1 | 0.7000 / 0.4773 / 0.3962 (21, 44, 30) | **1.0000 / 1.0000 / 1.0000** (30, 30, 30) | 0.7000 / 0.4773 / 0.3962 |
| claude-opus-5-5/order-fulfilment/full-aac/run-1 | 0.9832 / 0.9590 / 0.9435 (117, 122, 119) | **1.0000 / 1.0000 / 1.0000** (119, 119, 119) | 0.9832 / 0.9590 / 0.9435 |

The before figures reproduce PR #81 exactly. In the literal view, every re-export/barrel disagreement class goes to zero: 9 + 2 missing-in-apg and 23 + 5 missing-in-ref, which are the 11 / 28 of #81's E1 total. The resolved view equals v1.2E, as designed.

**Not done.** The ADR also asks for the resolved view to be compared against hand-written `viaReExport` edges. No such hand-written set exists yet; the human adjudication sheet from #81 (`human_verdict`) is still empty. The other 70 E1 cells and SO4 were not rerun. SO4 has 80 + 138 barrel rows, so that is where the next change is expected.

## 5. Consequences to watch (v1.3 only)

- **Barrel-induced cycles.** Literal-view `no-cyclic-deps` can report cycles through a barrel that the resolved graph hid. Per the ADR, these are findings.
- **Coupling metrics.** fan-in, fan-out and instability read the literal view. A widely imported barrel gains fan-in; its importers lose fan-out to the files behind it.
- **IMPORTS readers outside the templates.** These read every IMPORTS edge, so under the v1.3 defaults they see both views. They were not changed, because scoring is outside this unit; each needs its own view decision:
  - the scoring engine's universal metrics (`src/scoring-engine/universal-metrics.ts`: cycle count, fan-in, fan-out, instability, orphans). This is the main follow-up; by the table's reasoning the literal view is the consistent choice;
  - the drift detector (`src/neo4j-ingestion/drift-detector.ts`);
  - the judge's source context (`src/llm-critic/source-context.ts`);
  - the report graph (`src/report/graph-data-builder.ts`).
- **SCC cycle path.** `scc-cycles.ts` is off (`CYCLE_STRATEGY = 'cypher'`). If it is switched on, it must drop `viaReExport` edges to match `no-cyclic-deps`.
- **Edge properties.** A literal edge to a barrel that also declares one of the imported names carries every name of the statement in `importedNames`. Its v1.2E edge lists only the declared names. The resolved view has the same edge set as v1.2E, but this one property differs; the test records it.
