# Rationale: the declared architecture of DaedalusArch's own `src/`

Written 2026-10-16 on branch `v1.3-dogfood`, **before** the tool was run on `src/` with this spec (the only tool
command run so far is `firewall validate`, which checks the spec's syntax and globs and produces no finding). This
file and `daedalus-self.yaml` are committed first so that the spec cannot have been tuned to the results. The
results and their triage are in `Docs/v1.3/dogfood.md`.

## Sources

| Source | What it gave |
|---|---|
| `aidlc-docs/inception/application-design/component-dependency.md` | The v1.0 component model: C10 shared domain at the bottom, C1..C8 pipeline stages, C9 CLI, S1 pipeline. "Modules never reach into another module's internals"; every boundary crosses as a C10 value object; `GraphRepository` and `LLMProvider` are ports. |
| `aidlc-docs/inception/application-design/v1.2E-component-dependency.md` §2-§3 | The verified v1.2E import matrix, including the edges the design accepted: C3→C4 (template table lookup), C6→C4, C8→C13, C9→C2/C3/C4/C8/C12/C13, S1→everything. "C4 imports only C10", "C4 does not import C3", "C13 does not import C1". |
| `Docs/v1.3/construct-switches.md` | `compileFunctions` calls the construct-switch compile overlay first: fitness-compiler → construct-switches. The tier resolver reaches scoring by injection (`TieredScoringInput.tierResolver`), so scoring-engine does not import the switches. |
| `Docs/v1.3/cypher-interpreter.md` §2 | `MemoryGraphRepository implements GraphRepository`: cypher-interp is a second outbound adapter beside neo4j-ingestion; `createPipeline` builds it; the CLI parses the engine name. |
| `src/apg-enrich/cheap/index.ts`, `src/apg-enrich/ontology/index.ts` headers, `Docs/v1.3/cheap-semantics-design.md`, `Docs/v1.3/ontology-v0-design.md` | "The extractor is consumed, never edited": apg-enrich reads `APGResult` from apg-extractor; the ontology pass calls a model (llm-critic providers). |
| `src/ise/infer.ts` header, `Docs/v1.3/mcp-v2.md` | ISE reads a source snapshot, extracts the graph, emits and validates a spec (apg-extractor, spec-parser). The MCP server's `infer_spec` calls ISE; `evaluate_project` runs the existing pipeline; the fast tools read the spec and the rule metadata (spec-parser, fitness-compiler, scoring-engine tiers). |
| `README.md` | Module list and the MCP tool surface. |

## Style choice: hexagonal, one layer per module

The intended architecture is not a total order. It is a **shared kernel** (types and ports) under a set of peer
modules whose allowed couplings are a specific graph, wired by one composition root and driven by two inbound
adapters. The `layered` style would force an order and make every peer import look like a skip or an upward edge.
The `hexagonal` style reads `architecture.allowed_dependencies` as a graph, so declaring **one layer per module**
turns the design's dependency matrix into checkable rules:

- an import with no allowed edge either way is `layer-skip-graph` (an undeclared module coupling);
- an import against an allowed edge is `dependency-direction-graph`;
- the kernel importing any module is `core-isolation`.

Kinds (they bind the kind-based templates; they do not change the graph rules):

| Kind | Layers | Why |
|---|---|---|
| domain | `shared` (+ the `src/firewall-context` re-export shim) | C10/C11: contracts, ports (`GraphRepository`, `LLMProvider`, `SnapshotStore`, `ProcessRunner`, `PipelineStage`), context, errors |
| presentation | `cli`, `mcp-server` | the two entry points (C9; the MCP server) |
| application | `pipeline` (composition root), `apg-extractor`, `apg-enrich`, `ise`, `spec-parser`, `fitness-compiler`, `construct-switches`, `evaluation-engine`, `neuro-symbolic-router`, `scoring-engine`, `baseline`, `report` | the stages and analyses; pure computation over value objects |
| infrastructure | `neo4j-ingestion` (listed first, so it is the bound `infraLayer`), `cypher-interp`, `llm-critic` | the adapters behind the graph and model ports (S2, S4/C14) |

`apg-extractor` is classed as application although it reads source files through ts-morph: the design treats it as
a stage (C1) whose output is a value object, not as an adapter behind a port. This is a known tension and the APG v2
`io-outside-adapters` rule may report it.

## Allowed dependencies, edge by edge

Every module may import `shared`. Beyond that:

| From | To | Source |
|---|---|---|
| cli | pipeline, spec-parser, fitness-compiler, scoring-engine, baseline, report, neo4j-ingestion | v1.2E matrix row C9 (`validate` uses C3/C4, `drift-handler` uses the C2 snapshot store) |
| cli | cypher-interp, llm-critic | the `--engine` option (cypher-interpreter.md §2.3); the judge provider options (v1.2E C9 `buildLLMProviderConfig`) |
| mcp-server | pipeline, spec-parser, fitness-compiler, scoring-engine, ise | mcp-v2.md: `evaluate_project` runs the pipeline; `infer_spec` runs ISE; the fast tools read spec and rule metadata |
| pipeline | apg-extractor, spec-parser, fitness-compiler, construct-switches, neo4j-ingestion, cypher-interp, neuro-symbolic-router, evaluation-engine, llm-critic, scoring-engine, baseline, report | v1.2E matrix row S1, plus the v1.3 engine and switch hooks |
| spec-parser | fitness-compiler | v1.2E C3→C4 (template names for validation) |
| fitness-compiler | construct-switches | construct-switches.md (compile overlay called first in `compileFunctions`) |
| evaluation-engine | fitness-compiler | v1.2E C6→C4 (template lookup) |
| neuro-symbolic-router | evaluation-engine, llm-critic | v1.2E C5→C6, C7 |
| scoring-engine | report | v1.2E C8→C13 (actionable formatter) |
| apg-enrich | apg-extractor, llm-critic | apg-enrich headers |
| ise | apg-extractor, spec-parser | ise/infer.ts header |

Deliberately **absent** edges (the design says so, or nothing documents them):

- `fitness-compiler` → `spec-parser` ("C4 does not import C3"), and → anything but the kernel and the switches.
- `construct-switches` → anything but the kernel: it is called by the compiler and the pipeline; if it also imports
  the compiler, the two modules form a cycle.
- any adapter (`neo4j-ingestion`, `cypher-interp`, `llm-critic`) → any other module: adapters implement kernel ports.
- `scoring-engine` → `construct-switches` (injection, not import); `report` → anything ("C13 does not import C1").
- any module → `cli` or `mcp-server`; any module but the two entry points → `pipeline`.

## Rule selection

- **Defining (blocking candidates)**: `dependency-direction-graph`, `no-cyclic-deps`, `layer-skip-graph`,
  `core-isolation`, `domain-purity`, `port-adapter-pattern`, `domain-state-purity`, `port-dependency-inversion`.
- `domain-purity` forbids in the kernel: the graph driver, ts-morph, model SDKs, CLI/console packages, the MCP SDK,
  the ANTLR runtime and ajv. `node:child_process` is **not** forbidden: v1.2E puts `NodeProcessRunner` in C10 on
  purpose.
- Coupling, SOLID and convention metrics are kept with the thresholds the old self-spec (`specs/daedalus-arch.yaml`)
  had already argued for. They are advisory.
- `FF-CV02` (merged in by the style) is disabled: no `*Service` naming convention is intended here.
- Judge rules (FF-N01, FF-N02, merged in by the style) are not run: the dogfood run is `--symbolic-only`.

## APG v2 components

For the APG v2 templates the harness declares two component partitions: one `layer` component per layer (from the
layer model), and one `module` component per module folder with `publicApi: [<module>/index.ts]`. The second
encodes the v1.0 design sentence "modules never reach into another module's internals": an import of another
module's non-index file is a `deep-import-declared-api` finding. `src/shared` declares no single entry (its
sub-barrels are the API), and modules without an `index.ts` get no declared API.
