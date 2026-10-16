# v1.3 dogfood: DaedalusArch on its own `src/`

Written 2026-10-16 on branch `v1.3-dogfood` (cut from `origin/v1.3` at b08ec387). The tool was run on its own 283
hand-written source files (285 with the generated Cypher parser). It ran symbolic only, on the in-process Cypher
engine (`--engine cypher-interp`), with no Neo4j, no LLM and no secrets.

This is a self-application case study: a real-world test of the tool on a codebase whose design documents exist.
Nothing in `src/` was changed. The debt it found is listed in §6 with suggested fixes.

**Limitation.** One agent recovered the intended architecture, wrote the spec and triaged the findings. The spec was
committed before the run, so it could not be tuned to the results. The triage labels (real debt, spec too strict,
tool false positive), however, are a single rater's judgement and were not checked by anyone independent. The
mechanical agreement figures (44/44 with the mined graph, interpreter equal to the mirrors) do not depend on that
judgement. A second, blind triage of §5 would be needed before quoting the "0 tool false positives" figure as a
precision result.

## 0. Results in one screen

| What | Result |
|---|---|
| Declared spec | `specs/dogfood/daedalus-self.yaml`: hexagonal, one layer per module over a shared kernel, 52 allowed module edges. Committed (c78fb2b3) **before** any run. Rationale: `specs/dogfood/RATIONALE.md` |
| v1.3 verdict, declared spec | **fail**: 11 dependency-direction + 5 cycle rows (blocking), 33 layer-skip rows (advisory for hexagonal) |
| Triage of the 49 defining-rule rows (one rater, see Limitation) | **29 real debt**, **20 spec too strict**, **0 tool false positives** |
| Completeness check | The 44 undeclared cross-module import pairs that the ISE miner sees independently are the 44 S01/S03 rows the templates report: 0 missed, 0 extra. Every declared edge is used at least once |
| APG v2 (9 templates on the interpreter) | rows identical to the hand mirrors on 9/9 templates. Main finding: **8 modules form one strongly connected component** (`component-adp-cycle`, 18 edges) |
| Cheap proxies | `apg-enrich/ontology` (16 files) is unreachable from any product entry point; a hidden co-change coupling exists between `apg-extractor/id-generator.ts` and `neo4j-ingestion/graph-ingester.ts`. The generated parser causes 99.7 % of the clone flags and makes the run 9× slower |
| ISE inference (`infer_spec` code) | no style evidence (five-way tie at 0.20), defaults to clean-architecture, and maps 8 of 19 units differently from the declared spec. The inferred spec is fitted to the import graph, so it reports **0** direction or skip violations and misses all 24 real-debt module edges |
| Tool issues | 10 false positives or traps in advisory rules, APG v2 and the proxies (§7), plus 8 lessons (§8) |
| Gate | `npm run self-check` (in-process engine, about 20 s) fails on any defining-rule finding that is not in `specs/dogfood/known-findings.json` (the 29 debt rows). CI example: `Docs/v1.3/ci/self-check.example.yml` |

## 1. Procedure and order of events

1. **Spec first.** The intended architecture was recovered from:
   - `aidlc-docs/inception/application-design/component-dependency.md`;
   - the verified v1.2E dependency matrix (`v1.2E-component-dependency.md` §2-§3);
   - the v1.3 design notes (construct switches, Cypher interpreter, cheap semantics, ontology, MCP v2);
   - the module headers and the README.

   The spec and its rationale were committed (c78fb2b3). Before that commit, only `firewall validate` was run: it
   checks syntax and globs and produces no finding.
2. **ISE inference.** Spec inference ran on a snapshot of `src/` + `tsconfig.json` (`dogfood.ts infer`). It used the
   same code as the MCP `infer_spec` tool, and ran before any evaluation result of the declared spec existed.
3. **Evaluation.** `firewall evaluate --project . --spec specs/dogfood/daedalus-self.yaml --symbolic-only --engine cypher-interp --format json`.
4. **APG v2, cheap proxies and rule mining.** `dogfood.ts apg2`: extraction with `V13_APG2_OPTIONS`, ingestion into
   the interpreter (`MemoryGraphRepository`), the 9 APG v2 template texts executed there and compared with their
   mirrors, then all batch-1 and batch-2 cheap proxies and the cheap2 template mirrors. Rule mining (ISE Option 1
   majority vote) came out of step 2.
5. **Triage** of every defining-rule row, and of the blocking-tier APG v2 rows.
6. **Revised spec.** `daedalus-self.revised.yaml` is the declared spec plus the triage's "spec too strict" edges and
   an extraction exclude for the generated parser. Re-running it confirms that the residue is exactly the real debt
   (§5).

Commands (repository root):

```
node --import tsx scripts/v1.3/dogfood.ts infer
npx tsx bin/firewall.ts evaluate --project . --spec specs/dogfood/daedalus-self.yaml --symbolic-only --engine cypher-interp --format json
node --import tsx scripts/v1.3/dogfood.ts apg2                                     # declared spec, ~5.5 min (cheap proxies on the generated parser)
node --import tsx scripts/v1.3/dogfood.ts apg2 --spec specs/dogfood/daedalus-self.revised.yaml --suffix -revised   # ~50 s
npm run self-check
```

Raw outputs: `Docs/DiagnosticRuns/dogfood-2026-10-16/`.

## 2. The declared spec

Full text: `specs/dogfood/daedalus-self.yaml`. Reasons for each edge: `specs/dogfood/RATIONALE.md`.

| Layer (= module) | Kind | May import (besides `shared`) |
|---|---|---|
| `shared` (+ `src/firewall-context` shim) | domain (core) | nothing |
| `cli` | presentation | pipeline, spec-parser, fitness-compiler, scoring-engine, baseline, report, neo4j-ingestion, cypher-interp, llm-critic |
| `mcp-server` | presentation | pipeline, spec-parser, fitness-compiler, scoring-engine, ise |
| `pipeline` (role composition-root) | application | every stage and adapter |
| `apg-extractor`, `baseline`, `report` | application | nothing |
| `spec-parser` | application | fitness-compiler |
| `fitness-compiler` | application | construct-switches |
| `construct-switches` | application | nothing |
| `evaluation-engine` | application | fitness-compiler |
| `neuro-symbolic-router` | application | evaluation-engine, llm-critic |
| `scoring-engine` | application | report |
| `apg-enrich` | application | apg-extractor, llm-critic |
| `ise` | application | apg-extractor, spec-parser |
| `neo4j-ingestion`, `cypher-interp`, `llm-critic` | infrastructure (adapters) | nothing |

Rules:

- **Defining:** `dependency-direction-graph` (FF-S01), `no-cyclic-deps` (FF-S02), `layer-skip-graph` (FF-S03),
  `core-isolation` (FF-S04), `domain-purity` (FF-P01; the kernel may not import the graph driver, ts-morph, model
  SDKs, CLI packages, the MCP SDK, antlr4ng or ajv), `port-adapter-pattern` (FF-P03), `domain-state-purity` (FF-P06).
- **Advisory:** `port-dependency-inversion`, the coupling, SOLID and convention metrics.

## 3. ISE inference against the declared spec

ISE ran first and blind. Output: `ise-inferred-spec.yaml`, `ise-inference.json`.

**Style.** Every style scored 0 points, giving a five-way tie at confidence 0.20. `inferFromGraph` takes
`classification.best` and emits `style: clean-architecture` with "evidence: none". DaedalusArch has no framework,
no decorators and no layer-named folders, so the classifier has nothing to read. This is correct behaviour for the
classifier. Emitting a spec anyway is the questionable part (lesson L1).

**Layers.** All 19 units were mapped by structure, each with confidence 0.5.

| Unit | Declared | Inferred | Same? |
|---|---|---|---|
| shared, firewall-context | domain | domain | yes |
| apg-enrich, construct-switches, evaluation-engine, fitness-compiler, ise, neuro-symbolic-router, report, scoring-engine, spec-parser | application | application | yes (9) |
| apg-extractor, baseline | application | **domain** | no |
| neo4j-ingestion, cypher-interp | infrastructure (adapter) | **domain** | no: the graph stores become "domain" because they import only the kernel and are imported by many modules |
| llm-critic | infrastructure (adapter) | **application** | no |
| cli, mcp-server | presentation | **infrastructure** | no |
| pipeline | application (composition root) | **infrastructure** | no |

11 of 19 units agree. All 8 differences come from one cause: the structure mapper reads "imports little, imported
by much" as *domain* and "imports much" as *outer*. That is a topological sort, and adapters behind ports are
exactly the modules that look like sinks.

**Rules.**

| Aspect | Declared | Inferred |
|---|---|---|
| Model | a graph of 18 layers with 52 allowed edges | a total order of 3 layers |
| Within-layer coupling | every module pair is checked | 10 modules share one `application` layer, so any import among them is allowed (for example fitness-compiler → spec-parser, llm-critic → apg-enrich) |
| Direction / skip findings on `src/` | 11 + 33 | **0 + 0**. The order was derived from these same imports, so no import can point against it |
| Cycles | 5 | 5 (same rows) |
| `domain-purity` list | graph driver, ts-morph, model SDKs, CLI, MCP, antlr4ng, ajv | the preset's web-framework list (`@nestjs/*`, typeorm, express, prisma, sequelize). Irrelevant here, and it would not catch `neo4j-driver` in the "domain" it inferred, which contains the Neo4j adapter |
| Pattern rules | port-adapter-pattern | repository-pattern, use-case-isolation, controller-no-entity (nothing in the code to bind them) |
| Verdict | fail (blocking AHS 0.641) | fail on cycles only (blocking AHS 0.821) |

**Rule mining (ISE Option 1).** 127 candidates were mined, of which 126 apply.

- **Direction** (72 candidates). Five unit pairs have imports both ways, so they are module cycles. On four of them,
  the majority vote turns the minority direction into a "must not" rule:
  - fitness-compiler → spec-parser (1 of 6 edges; agrees with the declared spec);
  - llm-critic → apg-enrich (4 of 12; agrees);
  - fitness-compiler → apg-enrich (1 of 3; agrees);
  - fitness-compiler → construct-switches (1 of 6): **the wrong way round**. The design (`construct-switches.md`)
    says the compiler calls the switch overlay. The debt is the 5 imports back from construct-switches, but the
    majority vote enshrines them.

  The fifth pair, report ↔ scoring-engine, is a 1:1 tie, so no rule is mined and the cycle is not reported.
- **Closed-world** (19 candidates). Each states "unit X imports only what it imports today", for example "fitness-compiler
  imports only apg-enrich, construct-switches, neo4j-ingestion, shared, spec-parser". These freeze every debt edge
  as allowed. Mining is useful as a drift detector, not as a source of intent.
- **Framework-free and decorator-free** (19 + 14). All hold, because no framework package is used anywhere. The
  mined "framework" list does not contain `neo4j-driver` or the model SDKs, so these candidates carry no
  information here.
- **Acyclic** (1). "276/285 files lie on no import cycle" applies, although 9 files are on cycles (support 0.97 ≥
  threshold).

**Verdict on inference.** Inference describes the code as it is. On a codebase without style markers, it cannot
recover the intended layering. On this repository, the spec it emits would pass every one of the 24 module-boundary
violations the declared spec catches. The comparison supports the design choice that inferred specs are proposals
for human review (the MCP tool says so). It also shows that the review is load-bearing: see lesson L1 for what the
tool should say when it has no evidence.

## 4. Findings table (declared spec, `evaluate`)

Verdict **fail** (v1.3 tiered scoring). Deterministic AHS 0.472, blocking AHS 0.641. Graph: 285 files, 5,768 nodes,
7,336 edges, 100 % parse coverage, 0 unresolved imports. Run time 18 s for the whole CLI, 4.4 s in the pipeline.

| Rule | Tier | Rows | Triage |
|---|---|---|---|
| FF-S01 dependency-direction-graph | blocking | 11 | 11 real debt |
| FF-S02 no-cyclic-deps | blocking | 5 | 5 real debt (3 of them type-only) |
| FF-S03 layer-skip-graph | advisory (hexagonal) | 33 | 13 real debt, 20 spec too strict |
| FF-S04 core-isolation | blocking | 0 | the kernel imports no module |
| FF-P01 domain-purity | blocking | 0 | the kernel imports none of the forbidden packages |
| FF-P03 port-adapter-pattern | blocking | 0 | (only neo4j-ingestion is bound as the adapter layer, see L6) |
| FF-P06 domain-state-purity | blocking | 0 | |
| FF-P02 port-dependency-inversion | advisory | 1 | tool false positive (T2) |
| FF-SO01 single-responsibility-proxy | advisory | 22 | 19 in the generated parser (spec too strict: no exclude); 3 real (`RowStage` 37 methods, the cypher-interp `Builder` 37, `FirewallContext` 17) |
| FF-CV03 naming-repos | advisory | 3 | 3 tool false positives (T1) |
| FF-CV05 test-file-pairing | advisory | 267 | not applicable: merged in by the style; tests live in `tests/unit/**` (T9) |
| FF-CV06 no-index-logic | advisory | 3 | real: `apg-enrich/cheap/index.ts`, `apg-enrich/ontology/index.ts` and `apg-extractor/apg2/index.ts` hold logic |
| FF-C02 module-fan-out | advisory | 6 | real but advisory (`cli.ts`, `fitness-compiler.ts`, `llm-critic.ts`, `judge-stage.ts`, cheap and ontology entry points) |
| FF-C03 component-instability | advisory | 76 | metric; not triaged per row |
| FF-C05 max-fan-in | advisory | 1 | `apg-enrich/cheap/types.ts` (fan-in 28): a de facto shared contract (see D4) |

### APG v2 (declared spec, interpreter; `apg2-results.json`)

| Template | Tier | Rows | Interpreter = mirror | Triage |
|---|---|---|---|---|
| boundary-type-leak | blocking | 0 | yes | (only neo4j-ingestion is bound as `infraLayer`, see L6) |
| component-adp-cycle | blocking | 18 | yes | **real (D1)**: one SCC of 8 modules |
| component-sdp-violation | advisory | 14 | yes | the same back edges seen as instability inversions |
| component-main-sequence-distance | advisory | 4 | yes | tool false positive for 3 (T3); cypher-interp's comes from the generated parser |
| deep-import-declared-api | blocking | 115 | yes | spec too strict (§5.3) |
| deep-import-inferred-api | advisory | 384 | yes | imports of `shared` sub-files; the kernel has no single barrel by design |
| undeclared-async-coupling | advisory | 0 | yes | 7 SUBSCRIBES, 0 PUBLISHES |
| io-outside-adapters | blocking | 31 | yes | 13 real (D12), 18 spec too strict |
| nondeterminism-in-core | advisory | 50 | yes | clocks for timings (`pipeline` 18), the process env and the lock (kernel 13) |

## 5. Triage

### 5.1 The 11 dependency-direction rows (all real debt)

| # | Row (file:line → target) | Why it is debt |
|---|---|---|
| 1-5 | `construct-switches/compile.ts:11` → `fitness-compiler/types.ts` (type-only); `layer-view.ts:10` → `hexagonal-templates.ts`; `pipeline.ts:11` → `compiler-input.ts`; `rows.ts:22` → `role-exemptions.ts`; `rows.ts:23` → `ddd-templates.ts` | `fitness-compiler.ts:31` imports the switch overlay, and the overlay imports the compiler back. A module cycle: D2 |
| 6 | `fitness-compiler/bound-param-checker.ts:3` → `spec-parser/function-fields.ts` | The design says in so many words: "C4 does not import C3 … so no C3 <-> C4 cycle arises" (v1.2E matrix §3.1). It does now, for one map of YAML key names: D3 |
| 7-10 | `llm-critic/context-v2.ts:8`, `llm-critic.ts:26`, `llm-critic.ts:321`, `types.ts:10` → `apg-enrich/cheap/*` | An outbound adapter (the judge) depends on an analysis module, which itself depends on the adapter (`ontology` → llm providers): D4 |
| 11 | `report/dashboard-data-builder.ts:8` → `scoring-engine/report-formatter.ts` (`headlineAhs`) | The design has C8 → C13 only; this back edge closes a cycle: D5 |

### 5.2 The 5 cycle rows (all real debt; 3 type-only)

| Row | Note |
|---|---|
| `apg-enrich/cheap/index.ts` ⇄ `provenance.ts` | `provenance.ts:318` uses `await import('./index.js')`, a dynamic import that hides the cycle from the module loader. The tool counts dynamic imports, so it caught it: D10 |
| `fitness-compiler/bound-param-checker.ts` ⇄ `fitness-compiler.ts` | Each file imports the other's functions: D3 |
| `shared/interfaces/llm-provider.ts` ⇄ `shared/types/evaluation.ts` (two rows, one via `llm-config.ts`) | type-only (`LLMEffort`): D11 |
| `shared/taxonomy/violation-types.ts` ⇄ `shared/types/baseline.ts` | type-only (`BaselineStatus`): D11 |

The type-only cycles cost nothing at run time. They are minor kernel hygiene, and the open construct question Q2
(drop type-only cycles) would drop them.

### 5.3 The 33 layer-skip rows

Real debt (13):

| Rows | Debt |
|---|---|
| `apg-enrich/cheap/context.ts:9`, `construct-switches/graph.ts:8`, `construct-switches/layer-view.ts:9`, `fitness-compiler/apg2-in-memory.ts:10`, `ise/layer-mapper.ts:16` → `neo4j-ingestion/layer-annotator.ts` | Pure glob → layer matching lives in the Neo4j adapter, and five non-adapter modules reach into it: D6 |
| `apg-enrich/cheap/provenance.ts:47`, `:48` → `fitness-compiler/apg2-in-memory.ts`, `v13-in-memory-baselines.ts`; `fitness-compiler/cheap2-in-memory.ts:7` → `apg-enrich/cheap/types.ts` (type-only) | The in-memory rule mirrors (a second evaluator) sit inside the compiler and make an apg-enrich ⇄ fitness-compiler cycle: D7 |
| `llm-critic/claude-cli-provider.ts:35`, `judge-unit-selector.ts:8` → `fitness-compiler/glob-to-regex.ts`; `llm-critic/llm-critic.ts:9`, `construct-switches/rows.ts:21` → `evaluation-engine/violation-id.ts` | General utilities owned by one stage and borrowed by others: D8 |
| `mcp-server/evaluate-project.ts:18` → `cli/require-env.ts` | One inbound adapter imports the other: D9 |

Spec too strict (20). Each is an edge the design implies but the declared spec missed. All are added in
`daedalus-self.revised.yaml`, each marked `# triage:`.

| Rows | Why it is legitimate |
|---|---|
| `cli/cli.ts:28` → `apg-extractor/types.ts` | the `--graph-mode` option values (`GRAPH_MODES`) |
| `construct-switches/pipeline.ts:12` (type-only), `tiers.ts:10` → `scoring-engine/rule-tiers.ts` | the tier hook overrides `ruleTier` (construct-switches.md). The rationale had read "by injection" as "no import" |
| `mcp-server/fast-hints.ts:15`, `:16`, `:18`, `:21`; `import-check.ts:10`; `project-files.ts:11`; `source-ast.ts:13` → apg-extractor / apg-enrich | MCP v2 fast hints run the APG v2 and cheap passes on one file (mcp-v2.md) |
| `mcp-server/rule-explainer.ts:11` → `report/actionable-formatter.ts` | reuses the fix text instead of duplicating it |
| `mcp-server/context.ts:9` → `neo4j-ingestion/neo4j-repository.ts` | the MCP server is its own composition root, as the CLI is |
| `report/dashboard-data-builder.ts:6`, `:7`; `scoring-engine/report-builder.ts:27`, `:28`, `:30`; `universal-metrics.ts:20` → fitness-compiler template catalogue | template tags and metadata (FR-29). The catalogue is a read-only table, though it lives in the compiler |
| `scoring-engine/scoring-engine.ts:10`, `universal-metrics.ts:21` → `evaluation-engine/scc-cycles.ts` | the shared SCC cycle strategy (BR-U3-45) |

Tool false positives among the defining-rule rows: **none**. Every row is an import that exists, at the line given,
between the layers named.

### 5.4 Blocking APG v2 rows

- **component-adp-cycle (18 edges, real, D1).** fitness-compiler, spec-parser, construct-switches,
  evaluation-engine, scoring-engine, report, apg-enrich and llm-critic form one strongly connected component. This is
  the single most important finding. Every module of the core pipeline except the extractor is in one tangle,
  although the design document says that "C4 imports only C10". The edges include allowed ones (spec-parser →
  fitness-compiler, evaluation-engine → fitness-compiler), because the cycle closes through the debt edges. FF-S02
  sees only file-level cycles, and none of these closes at file level. Fixing D2 (by inversion), D3, D4, D5, D7 and
  D8 makes the module graph acyclic: the remaining edges then all point towards fitness-compiler and shared.
- **deep-import-declared-api (115, spec too strict).** The dogfood harness declared `<module>/index.ts` as the
  public API of every module. It read the v1.0 sentence "modules never reach into another module's internals" as an
  entry-file rule. The sentence is about the value objects that cross boundaries, and the codebase never adopted
  barrel-only imports: fitness-compiler alone is deep-imported 52 times. Adopting the rule would be a large
  mechanical change, and it is not what the design asked for. The 24 real-debt edges above are all deep imports too.
- **io-outside-adapters (31).**
  - Real (13), D12:
    - `shared/process/neo4j-lock.ts`: 6 members do fs I/O inside the kernel;
    - `baseline/baseline-manager.ts`: load and save, with no port (unlike snapshots, which have `SnapshotStore`);
    - `report/report-generator.ts:64`: writes the HTML file;
    - `apg-enrich/cheap/provenance.ts`: 4 members (`materialise`, `readLoopRun`, `snapshotOf`, `analyseProvenance`).
      These are experiment-harness I/O in product code.
  - Spec too strict (18):
    - `spec-parser`, 9 rows: reading the spec, the presets and the ADRs is the parser's job by design;
    - `ise`, 5 rows: it works on a snapshot directory by design;
    - `apg-extractor/apg-extractor.ts:32`: one `existsSync`;
    - `apg-enrich` co-change: 1 row reading the git history;
    - ontology cassette and grounding reads: 2 rows.

    The spec classed these modules as application. A truer model gives them a file-reading port or classes them as
    adapters.

## 6. Architectural debt (not fixed in this PR) and suggested fixes

| Id | Debt | Evidence | Suggested fix |
|---|---|---|---|
| D1 | 8-module tangle | component-adp-cycle, 18 edges | D2 + D3 + D4 + D5 + D7 + D8 break it; then gate on `component-adp-cycle` |
| D2 | construct-switches ⇄ fitness-compiler | 5 S01 rows; `fitness-compiler.ts:31` | Invert it: declare a `CompileOverlay` / `RowStage` port in the compiler's types (or `shared`), let construct-switches implement it and `createPipeline` inject it, so that the compiler no longer imports the switches. Or fold `compile.ts` into the compiler |
| D3 | fitness-compiler → spec-parser, plus the file cycle with `bound-param-checker.ts` | `bound-param-checker.ts:3`, `:8`; `fitness-compiler.ts:20` | Move `FIELD_TO_YAML_KEY` to `shared/types/spec.ts`; move `buildParams` / `filterEnabled` to a leaf file both import |
| D4 | llm-critic → apg-enrich, and apg-enrich/ontology → llm-critic | 4 S01 rows; fan-in 28 on `cheap/types.ts` | Move the cheap-fact contract the judge reads (`cheap/types.ts`) to `shared`; split `apg-enrich` into `cheap` (no model) and `ontology` (uses providers) |
| D5 | report → scoring-engine | `dashboard-data-builder.ts:8` | Move `headlineAhs` into `report` (or `shared`) |
| D6 | layer matching inside the Neo4j adapter | 5 S03 rows to `layer-annotator.ts` | Move the pure glob → layer function to `shared` (or `spec-parser`); `neo4j-ingestion` then imports it like everyone else |
| D7 | in-memory rule mirrors inside the compiler | `provenance.ts:47-48`, `cheap2-in-memory.ts:7`; `cheap2-in-memory.ts` unreachable from product entry points | Move `*-in-memory*.ts` to their own module (for example `src/in-memory-eval/`), or under `scripts/` if only experiments and tests use them |
| D8 | utilities owned by stages | `glob-to-regex` used by llm-critic (2); `violation-id` used by llm-critic and construct-switches | Move both to `shared` |
| D9 | mcp-server → cli | `evaluate-project.ts:18` | Move `requireEnv` / `MissingEnvError` to `shared` |
| D10 | cycle hidden by a dynamic import | `cheap/provenance.ts:318` | Pass `openProject` / `enrichCheap` in as parameters, or move them to a leaf file |
| D11 | type-only kernel cycles | `llm-provider.ts:2`, `evaluation.ts:10`; `violation-types.ts:3`, `baseline.ts:3` | Move `LLMEffort` to `types/llm-config.ts` (or `enums.ts`) and `BaselineStatus` to `enums.ts` |
| D12 | I/O outside the adapters | 13 io rows (see 5.4); `neo4j-lock.ts` also reads env (3 config-surface flags) | Move `neo4j-lock.ts` to `neo4j-ingestion`; put baseline I/O behind a store port as snapshots are; let the CLI write the HTML; move the provenance experiment I/O to `scripts/` |
| D13 | research code in product `src/` | reachability: `apg-enrich/ontology/**` (16 files), `fitness-compiler/cheap2-in-memory.ts`, `ise/outliers.ts`, `llm-critic/filter-explain.ts`, `spec-parser/preset-loader.ts` are reached by no product entry point (only by `scripts/` and tests) | Move them under `scripts/` or a separate research package, or wire them in |
| D14 | hidden coupling on the node id format | co-change: `apg-extractor/id-generator.ts` and `neo4j-ingestion/graph-ingester.ts` changed together in 3 commits (confidence 0.75) with no import between them | Put the id format in `shared` and give it a contract test |

## 7. Tool false positives and traps (issues, with file:line)

None affects a defining rule of the declared spec.

| # | Rule / proxy | What happens | Where |
|---|---|---|---|
| T1 | FF-CV03 naming-repos | `c.name CONTAINS 'Repo'` matches **Report**: `AssembleReportCommand`, `GenerateReportCommand`, and a generated `SubqueryInTransactionsReportParametersContext`. The template is frozen, so the fix belongs in a v1.3 rewrite (a word-boundary regex such as `Repo(sitory)?$`) | `src/fitness-compiler/cypher-templates.ts:468`; rows at `src/pipeline/commands/assemble-report-command.ts:35`, `generate-report-command.ts:19` |
| T2 | FF-P02 port-dependency-inversion | `PipelineExecutor` scores ratio 0, for two reasons. (a) The constructor parameter `readonly PipelineCommand[]` (an array of an interface) yields no CONSTRUCTOR_INJECTS edge, only an EXTRACTOR_005 warning, so the only dependency counted is the `FirewallContext` class. (b) The layer declares role `composition-root`: `apg2Params` honours that role, but `bindHexagonalLayers` only detects composition roots from graph shape, so `pipeline` stays a use-case layer | (a) `src/apg-extractor/edge-extractor.ts:223-247`; (b) `src/fitness-compiler/hexagonal-templates.ts:178-181` vs `src/fitness-compiler/apg2-in-memory.ts:79-88`; row at `src/pipeline/pipeline-executor.ts:24` |
| T3 | component-main-sequence-distance | Abstractness counts every TypeScript `interface` as abstract. Data-shape interfaces are not abstractions, so `ise` (0 classes, 29 interfaces) gets A = 1, `mcp-server` 0.984 and `apg-enrich` 0.924: all "zone of uselessness" | `src/apg-extractor/apg2/components.ts:169` |
| T4 | io-outside-adapters (API list) | Values derived from an fs call's result are attributed to fs: `root.replace(...)` on a `fs.realpathSync` result is listed as API `fs:root.replace`, and `fs.readdirSync(...).filter` as an fs call. The rows themselves are right, because each member also makes a real fs call, but the evidence is noisy | `src/apg-extractor/apg2/common.ts:167` (`originOfValue`, initializer rule); seen at `src/ise/graph-view.ts:109` |
| T5 | reachability: unreachable-module | npm-script entry points are not entry points. `src/mcp-server/check-file-cli.ts` (`npm run mcp:check-file`) is flagged unreachable, because the entry-name list (`main`, `cli`, `server`, …) does not match `check-file-cli` and `package.json` scripts are not read | `src/apg-enrich/cheap/reachability.ts:16-17` |
| T6 | cohesion: low-cohesion | LCOM4 on port implementations. `NullLLMProvider` (a null object: three independent methods by design) and `MemoryGraphRepository` (`healthCheck` and `close` are separate interface methods) are flagged | `src/llm-critic/null-provider.ts`, `src/cypher-interp/repository.ts` |
| T7 | name-behaviour: dto-does-io | `ProjectView` is taken for a DTO because of its name and flagged 6 times for fs reads. It is a file-system view object by design | `src/mcp-server/project-files.ts` |
| T8 | DEEP_IMPORT (a false negative, not a false positive) | Each import edge gets one DEEP_IMPORT, for the first component kind that sees it. With layer components declared before module components, every declared module API check is silently skipped (the first harness run reported 384 rows, all into `shared`, and 0 into the declared modules). Declaration order should not change which rules can fire | `src/apg-extractor/apg2/components.ts:276` |
| T9 | FF-CV05 test-file-pairing | Only same-directory `.test.ts` / `.spec.ts` siblings count, so 265 of 283 files "have no test" in a repository whose tests live in `tests/unit/**`. The style merges the rule into the spec, although the spec did not declare it | `src/fitness-compiler/cypher-templates.ts:497-510` |
| T10 | shared-literals | 455 shared-number-literal flags (for example 54 between apg-enrich and apg-extractor). Small integers are not domain constants | `src/apg-enrich/cheap/literals.ts` |

## 8. Lessons for the tool

- **L1. ISE should refuse to guess, or say loudly that it guessed.** With zero evidence for every style,
  `inferFromGraph` emits a confident-looking spec. The MCP wrapper adds a low-confidence note, but the emitted YAML
  header only says "confidence 0.20". The structure mapper also maps adapters behind ports to `domain`, because they
  are sinks. The inferred spec is the import graph restated, so it cannot find direction debt at all (0 rows here
  against 24 real ones). Suggestions:
  - with no evidence, emit the module-per-layer graph form (as in §2), with the mined edges as a **proposal to
    prune**, not a fitted total order;
  - rank units by fan-in **and** by the external packages they import (`neo4j-driver` ⇒ adapter);
  - mark closed-world rules as drift detectors.
- **L2. Generated code must be excludable by default.** The 2 MB ANTLR parser (`src/cypher-interp/generated/`,
  already `@ts-nocheck` and eslint-ignored) produced:
  - 19 of 22 SO01 rows and 1 CV03 row;
  - 76,556 of 76,768 clone flags and 9,339 of 9,794 shared-number flags;
  - 9× the cheap-proxy time (307 s → 34 s without it);
  - 491 "decorator-free classes" in the mined rules.

  `default_exclude_paths` fixes it, but a default (files with a `@generated` / `@ts-nocheck` header, `generated/`
  directories) would spare every user.
- **L3. `npm run dev` does nothing.** It runs `tsx src/cli/index.ts`, which only re-exports `main`. The entry point
  is `bin/firewall.ts`.
- **L4. `baseline` has no `--engine`.** Creating a baseline needs Neo4j even though `evaluate` does not
  (`src/cli/cli.ts:470-476`).
- **L5. Baseline keys ignore the target.** `generateKey` hashes rule + file + violation type
  (`src/baseline/baseline-manager.ts:11-18`). A new forbidden import from a file that already has one (for example a
  sixth import out of `construct-switches/rows.ts`) is therefore "baselined". `self-check` keys on rule + file +
  target + discriminator instead. The baseline key should include `target` for edge rules.
- **L6. Multiple adapter layers are under-bound.** The hexagonal binding (`bindHexagonalLayers`,
  `hexagonal-templates.ts:168-171`) and `bindLayerParams` take the **first** presentation and infrastructure layer.
  With three adapter modules, `port-adapter-pattern` and `boundary-type-leak` only look at `neo4j-ingestion`;
  `cypher-interp` and `llm-critic` are unchecked. Their zero rows are partly zero coverage. `infraLayer` should be a
  list.
- **L7. APG v2 and cheap2 are not reachable from `evaluate`.** `ExtractCommand` extracts with the default options
  (no `apg2`), and `compileFunctions` does not bind `apg2Params`, so the dogfood needed a harness
  (`scripts/v1.3/dogfood.ts`). A `--apg2` flag on `evaluate`, with templates named in the spec, would make the most
  useful finding here (the 8-module SCC) part of the normal run.
- **L8. What worked.**
  - The hexagonal graph form with one layer per module expressed a real design document directly.
  - FF-S01 + FF-S03 matched the independently mined import graph pair for pair (44/44, 0 extra), at exact lines,
    with the type-only flag.
  - The in-process engine made the whole symbolic run a 20-second, dependency-free CI step. Its rows equalled the
    hand mirrors on all 9 APG v2 templates for this 2,437-node / 8,054-edge graph.
  - The tool counted a dynamic `import()` as an edge, and so found a cycle the author had deliberately hidden from
    the loader.

## 9. What a reviewer would care about

The tool's own words, ranked by what a reviewer of DaedalusArch would act on:

1. The core pipeline is one strongly connected tangle of 8 modules (D1), against a design that drew a DAG. Any
   change to the compiler can ripple into the switches, scoring, report, the judge and the enrichers.
2. The compiler imports the spec parser (D3), which its own design document rules out by name.
3. The LLM judge adapter depends on the analysis code that depends on it (D4).
4. The kernel does file and environment I/O for the Neo4j lock (D12). `shared` is meant to hold contracts.
5. A cycle was hidden with a dynamic `import()` instead of being removed (D10).
6. A whole research subsystem (`apg-enrich/ontology`, 16 files) ships in `src/` but is unreachable from any product
   entry point (D13).
7. A silent contract on node ids couples the extractor and the ingester. Only the git history shows it (D14).

## 10. Self-check and CI

- `npm run self-check` (`scripts/v1.3/self-check.ts`):
  1. runs `firewall evaluate` with the revised spec, `--symbolic-only --engine cypher-interp`;
  2. keys every row of the defining rules (FF-S01, S02, S03, S04, P01, P03, P06) on rule + file + target +
     discriminator;
  3. fails (exit 1) on any key not in `specs/dogfood/known-findings.json`, which holds the 29 debt rows of §5.

  A key that disappears is reported as fixed: run `npm run self-check -- --update` and commit the shorter list.
  `--report <file>` keeps the JSON report. Exit 2 means the evaluation itself failed.
  - Verified: a planted re-export from `src/report/index.ts` into `src/cli/` makes the check fail with
    `NEW FF-S01 src/report/index.ts:12 …` (reverted).
  - Run time: about 20 s; no Neo4j, no LLM, no secrets.
- `Docs/v1.3/ci/self-check.example.yml` is an inert GitHub Actions example: Node 22, `npm ci`, `npm run self-check`,
  with the report uploaded as an artefact. To enable it, copy it to `.github/workflows/`. It is not enabled by this
  PR.
- The gate does not include the APG v2 templates (L7). Once `evaluate` can run them, add `component-adp-cycle` to
  the gated rules: it is the rule that would have prevented D1.

## Files

| Path | What |
|---|---|
| `specs/dogfood/daedalus-self.yaml`, `RATIONALE.md` | declared spec and its sources (committed before any run) |
| `specs/dogfood/daedalus-self.revised.yaml` | declared spec + the "spec too strict" edges + the generated-code exclude |
| `specs/dogfood/known-findings.json` | the 29 debt rows the self-check accepts |
| `scripts/v1.3/dogfood.ts` | `infer` (ISE + mining) and `apg2` (APG v2 on the interpreter, cheap proxies) |
| `scripts/v1.3/self-check.ts`, `package.json` `self-check` | the gate |
| `Docs/v1.3/ci/self-check.example.yml` | CI example |
| `Docs/DiagnosticRuns/dogfood-2026-10-16/` | `evaluate-declared.json`, `evaluate-revised.json`, `evaluate-ise-inferred.json`, `ise-inferred-spec.yaml`, `ise-inference.json`, `apg2-results[-revised].json`, `cheap-results[-revised].json` (clone and literal flags as counts per module pair) |
