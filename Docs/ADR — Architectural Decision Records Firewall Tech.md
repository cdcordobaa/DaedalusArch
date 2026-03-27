# ADR — Architectural Decision Records: Firewall Technical Foundations

> This document records the key architectural and technical decisions underpinning the Architectural Firewall. Each decision is grounded in research evidence, spike validation, or reasoned trade-off analysis. It serves as the technical companion to the PRD.
> 

---

## ADR-001: TypeScript as the sole target language for v1

**Status**: Accepted 

**Date**: 2026-03-27 

**Context**: The Firewall needs deep static analysis — type resolution, interface extraction, decorator parsing, constructor injection detection. Supporting multiple languages would multiply engineering effort and dilute analysis depth. 

**Decision**: Target only TypeScript projects in v1. 

**Rationale**:

- **ts-morph** provides a mature, well-documented wrapper over the TypeScript compiler API with full type resolution — no separate compilation step needed
- TypeScript is the dominant language for LLM-generated backend code in the NestJS/Express ecosystem we're benchmarking
- Spike 1 validated that ts-morph correctly resolves: barrel imports, path aliases, interface vs. concrete types for DI, decorators, and export visibility
- Depth over breadth is a non-negotiable design principle (PRD Segmento 6)

**Alternatives Considered**:

| Alternative | Why Rejected |
| --- | --- |
| Python (ast module) | No native type system → cannot detect DI violations or interface compliance |
| Java (JavaParser) | Requires compilation; LLM-generated Java often has unresolvable dependencies |
| Multi-language from day one | Unacceptable scope for a thesis deliverable; dilutes analysis quality |

**Consequences**:

- Benchmark is limited to TypeScript projects → acknowledged as a threat to external validity
- Future language support (Python, Java) is a v2.0 Could-Have, requiring new extractor modules per language

---

## ADR-002: ts-morph as the static analysis engine (not the TypeScript Compiler API directly)

**Status**: Accepted 

**Date**: 2026-03-27 

**Context**: We need to extract structural information from TypeScript source code — classes, interfaces, methods, imports, implements/extends relationships, constructor parameter types, and decorators. 

**Decision**: Use **ts-morph** (v22+) as the extraction engine. 

**Rationale**:

- ts-morph wraps the TypeScript Compiler API with a developer-friendly, navigable AST
- Provides `.getType().getText()` for resolving interface vs. concrete types — critical for dependency inversion detection
- Supports **lenient parsing**: can parse files even when dependencies are missing (common in LLM-generated code that may reference uninstalled packages)
- Spike 1 confirmed: barrel re-exports, `@Module()` decorator extraction, path alias resolution, and constructor injection type resolution all work correctly
- No build step required — works directly on source files with a tsconfig.json

**Alternatives Considered**:

| Alternative | Why Rejected |
| --- | --- |
| Raw TypeScript Compiler API | Verbose, low-level; ts-morph is a strict superset with better DX |
| Tree-sitter (TypeScript grammar) | Syntactic only — no type resolution, cannot distinguish interface from class in DI |
| SWC / esbuild parsers | Optimized for speed, not analysis depth; no type checker integration |

**Consequences**:

- Tied to ts-morph's release cycle and TypeScript version support
- Lenient mode may miss some edges when source is severely broken → mitigated by reporting parse coverage %

---

## ADR-003: Neo4j as the graph database for the APG

**Status**: Accepted 

**Date**: 2026-03-27 

**Context**: The Architectural Property Graph (APG) needs to be stored in a queryable graph database so that fitness functions can be expressed as graph queries. 

**Decision**: Use **Neo4j** (Community Edition) as the graph storage and query engine. 

**Rationale**:

- Cypher is the most mature and readable graph query language — fitness functions expressed as Cypher are auditable and reproducible
- Neo4j Browser provides free interactive visualization — critical for exploring violation patterns and generating publication-quality figures
- The APG is inherently a labeled property graph: nodes have labels (File, Class, Interface, Method) and properties (name, layer, role), edges have types (IMPORTS, IMPLEMENTS, CONSTRUCTOR_INJECTS)
- Spike 2 validated: all 17 fitness functions compile to valid Cypher and execute in < 5 seconds total
- Community Edition is free and sufficient for per-project graphs (hundreds to low thousands of nodes)

**Alternatives Considered**:

| Alternative | Why Rejected |
| --- | --- |
| In-memory graph (e.g., graphology.js) | No query language — fitness functions would be imperative JS code, not declarative queries. Loses auditability and reproducibility. |
| Memgraph | Cypher-compatible but smaller ecosystem; Neo4j Browser visualization is a significant advantage for research |
| Amazon Neptune | Cloud-only; adds latency and cost; overkill for single-project graphs |
| PostgreSQL + recursive CTEs | Can model graphs but cycle detection and path queries are painful; Cypher is purpose-built for this |
| ArangoDB (AQL) | Less mature ecosystem; Cypher is better known in the research community |

**Consequences**:

- Neo4j must be running locally (or in Docker) for evaluation — adds a dependency to the setup
- Community Edition has no clustering — not needed for benchmark workloads but limits future product scaling
- Each project evaluation creates/destroys a graph — stateless by design

---

## ADR-004: Architecture-as-Code (AoC) YAML with 3-layer structure

**Status**: Accepted 

**Date**: 2026-03-27 

**Context**: We need a formal, machine-readable specification format that architects can write to declare what architectural rules a project should follow. This format drives the entire evaluation pipeline. 

**Decision**: Define a custom **AoC YAML** format with three layers:

- **Layer A — Architectural Model**: Declares the style, layers, allowed dependencies, and mapping rules (directories → layers, naming → roles, decorators → annotations)
- **Layer B — Fitness Functions**: Declares which fitness functions to evaluate, with dimension tags, severity, and optional thresholds
- **Layer C — Scoring Configuration**: Declares dimension weights for AHS computation and pass/fail thresholds

**Rationale**:

- Separates *what to verify* (Layer A + B) from *how to score* (Layer C) from *how to execute* (Cypher compilation is internal)
- YAML is human-readable and widely familiar to developers and architects
- The 3-layer design allows the same fitness function catalog to be reused across different architectural styles with different scoring weights
- Style templates (e.g., `style: clean-architecture`) auto-load a default Layer B with 17 pre-built fitness functions — architects only need to customize Layer A mappings

**Example (abbreviated)**:

```yaml
# Layer A — Model
architecture:
  style: clean-architecture
  layers:
    - name: domain
      directories: ["src/domain/**"]
      allowed_dependencies: []
    - name: application
      directories: ["src/application/**"]
      allowed_dependencies: ["domain"]
    - name: infrastructure
      directories: ["src/infrastructure/**"]
      allowed_dependencies: ["domain", "application"]
  mappings:
    decorators:
      Injectable: { role: "service" }
      Controller: { role: "controller" }
    naming:
      "*Repository": { role: "repository" }
      "*UseCase": { role: "use-case" }

# Layer B — Fitness Functions
fitness_functions:
  - id: dependency-direction
    dimension: structural
    severity: critical
  - id: dependency-inversion
    dimension: pattern
    severity: critical
    threshold: 0.0  # zero tolerance
  # ... (17 total from template)

# Layer C — Scoring
scoring:
  weights:
    structural: 0.25
    coupling: 0.15
    pattern: 0.25
    solid: 0.20
    convention: 0.15
  pass_threshold: 0.70
```

**Alternatives Considered**:

| Alternative | Why Rejected |
| --- | --- |
| ArchUnit-style Java DSL | Language-specific; not declarative; can't be compiled to Cypher |
| JSON Schema | Verbose; less human-readable for architects |
| TOML | Less expressive for nested structures (layer definitions, mappings) |
| Custom DSL | Higher learning curve; YAML tooling is ubiquitous |

**Consequences**:

- Need to define and publish a JSON Schema for AoC YAML validation (Should-Have v1.1)
- Extensibility: new architectural styles require new template libraries but no format changes
- Risk: YAML's flexibility means malformed specs are possible → mitigated by validation at parse time

---

## ADR-005: Architectural Property Graph (APG) — a purpose-built, minimal graph schema

**Status**: Accepted 

**Date**: 2026-03-27 

**Context**: Existing code property graphs (CPGs) used by CodeQL and Joern are designed for security analysis and include control flow, data flow, and full AST structure. This is far more than needed for architectural evaluation and causes 20-30+ second analysis times. 

**Decision**: Define a **purpose-built APG** with only architecture-relevant nodes and edges. 

**Schema**:

### Node Labels

| Label | Properties | Purpose |
| --- | --- | --- |
| **File** | name, filePath, layer, role, isBarrel | Source file, annotated with architectural layer |
| **Class** | name, filePath, layer, role, isExported, isAbstract, decorators[] | Class declaration |
| **Interface** | name, filePath, layer, role, isExported | Interface declaration |
| **Method** | name, filePath, visibility, isStatic, isAsync | Method within a class |
| **Function** | name, filePath, isExported | Standalone function |

### Relationship Types

| Type | From → To | Purpose |
| --- | --- | --- |
| **IMPORTS** | File → File | Module dependency |
| **IMPLEMENTS** | Class → Interface | Interface implementation |
| **EXTENDS** | Class → Class | Inheritance |
| **CONSTRUCTOR_INJECTS** | Class → Interface/Class | DI parameter type (resolved) |
| **CALLS** | Method/Function → Method/Function | Call graph |
| **DECLARES** | File → Class/Interface/Function | Declaration containment |
| **CONTAINS** | Class → Method | Member containment |

**Rationale**:

- This schema captures exactly what's needed for the 17 fitness functions — nothing more
- Dependency direction → IMPORTS edges between annotated layers
- Dependency inversion → CONSTRUCTOR_INJECTS pointing to Interface vs. Class
- Repository pattern → Class nodes with role=repository + IMPLEMENTS edge to Interface
- Cycle detection → IMPORTS graph traversal
- Coupling metrics → fan-in/fan-out on IMPORTS + CALLS edges
- SOLID proxies → DECLARES count, EXTENDS depth, Method count per Class
- **5 node types + 7 edge types** vs. CodeQL's **50+ node types** — this is the "right-sized" representation

**Spike Validation**: All 17 fitness functions execute correctly on this schema. No missing information was encountered.

**Consequences**:

- Cannot detect data flow violations (acknowledged; out of scope — H4 quantifies this gap vs. CodeQL)
- Cannot detect runtime behavior or dynamic dispatch patterns
- Adding new fitness functions may require schema extensions (e.g., adding a THROWS edge for error handling depth)

---

## ADR-006: Fitness functions compiled to parameterized Cypher queries

**Status**: Accepted 

**Date**: 2026-03-27 

**Context**: Fitness functions need to be executed against the APG. The question is whether they should be imperative code (JavaScript functions traversing the graph) or declarative queries. 

**Decision**: Each fitness function is a **parameterized Cypher query template** that gets instantiated with values from the AoC YAML spec. 

**Rationale**:

- **Determinism**: Cypher queries are pure functions over the graph — same graph, same result, always
- **Auditability**: Researchers can inspect, validate, and publish the exact queries used for evaluation
- **Separation of concerns**: Architects declare *what* in YAML; the compiler generates *how* in Cypher
- **Composability**: New fitness functions = new Cypher templates; no changes to the engine
- Spike 2 validated: all 17 templates compile and execute correctly

**Example — dependency-direction template**:

```
// Finds edges that violate allowed dependency direction
MATCH (source:File)-[:IMPORTS]->(target:File)
WHERE source.layer IS NOT NULL
  AND target.layer IS NOT NULL
  AND NOT target.layer IN $allowedDeps[source.layer]
RETURN source.filePath AS violator,
       source.layer AS sourceLayer,
       target.layer AS targetLayer,
       target.filePath AS dependency
```

**Alternatives Considered**:

| Alternative | Why Rejected |
| --- | --- |
| JavaScript traversal functions | Non-deterministic risk (execution order); harder to audit; couples engine to implementation |
| GraphQL queries | Not designed for graph traversal; no cycle detection primitives |
| Gremlin (TinkerPop) | More verbose than Cypher for pattern matching; smaller research community |

**Consequences**:

- Some fitness functions require creative Cypher (e.g., cycle detection via `apoc.path.expandConfig`) — APOC plugin may be needed
- Cypher's expressiveness has limits — truly complex analysis might need post-processing in JS (none needed for current 17 functions)

---

## ADR-007: AVR (Architectural Violation Ratio) + AHS (Architectural Health Score) as the scoring model

**Status**: Accepted 

**Date**: 2026-03-27 

**Context**: We need a quantitative, multi-dimensional scoring system that enables statistical analysis (ANOVA) and meaningful comparison across projects, LLMs, and spec conditions. 

**Decision**: Two-tier scoring model:

- **AVR** (per dimension): Ratio of violated fitness functions to total fitness functions in that dimension. Range: 0.0 (all pass) to 1.0 (all fail).
- **AHS** (aggregate): Weighted complement of AVR across dimensions. AHS = Σ(wᵢ × (1 - AVRᵢ)). Range: 0.0 (complete failure) to 1.0 (perfect compliance).

**Rationale**:

- **Multi-dimensional AVR** enables per-dimension analysis: "LLMs fail at pattern compliance but succeed at naming conventions" → this is the failure taxonomy for H2
- **Weighted AHS** enables single-number comparison for H3 ANOVA: "Formal specs produce higher AHS than informal"
- The weighting in Layer C allows researchers to calibrate importance — structural violations might matter more than convention violations
- Spike validated: AHS discrimination is monotonic (0.85 clean → 0.33 broken)

**Scoring Dimensions (5)**:

| Dimension | # Functions | Weight (default) | What it measures |
| --- | --- | --- | --- |
| Structural | 3 | 0.25 | Layer boundaries, dependency direction, no bypass |
| Coupling | 3 | 0.15 | Stability, fan-out, component instability |
| Pattern | 3 | 0.25 | DI, repository pattern, domain purity |
| SOLID | 4 | 0.20 | SRP, ISP, use-case isolation, inheritance depth |
| Convention | 4 | 0.15 | Naming, test coverage proxy, error handling, orphans |

**Alternatives Considered**:

| Alternative | Why Rejected |
| --- | --- |
| Single pass/fail per project | No statistical power; can't do ANOVA on binary data |
| Violation count (raw) | Not normalized; projects with more files would score worse by default |
| Weighted violation count | Better, but doesn't separate dimensions — loses diagnostic power |
| LLM-as-judge scoring | Non-deterministic; violates core principle |

**Consequences**:

- Binary AVR (pass/fail per function) may lose nuance — a function with 1 violation scores the same as one with 50. Violation-count-weighted AVR is a Should-Have for v1.1.
- Default weights are a researcher judgment call → must be justified in thesis and tested with sensitivity analysis

---

## ADR-008: Seeded violation strategy for ground truth (not expert annotation)

**Status**: Accepted 

**Date**: 2026-03-27 

**Context**: Instrument validation (H1) requires ground truth — projects with known violations to measure Precision, Recall, and Cohen's κ. Traditional approach: have experts annotate code. 

**Decision**: Use **seeded violations by construction** instead of post-hoc expert annotation. 

**Rationale**:

- Start from a clean reference project (zero violations, verified manually)
- Create violation variants by deliberately introducing specific violations (e.g., inject a concrete class instead of an interface → dependency-inversion violation)
- Each variant has a [**MANIFEST.md**](http://MANIFEST.md) listing: violation type, file path, expected detecting fitness function, dimension
- Ground truth is known *by construction* — no ambiguity, no inter-rater disagreement
- Spike 3 validated: 100% detection rate across all seeded variants

**Advantages over expert annotation**:

- Eliminates inter-rater reliability concerns (the manifest IS the truth)
- Scales to 20+ variants without expert availability constraints
- Each variant tests exactly one dimension → isolation of fitness function behavior
- Cohen's κ is computed against the manifest, not between raters

**Limitations**:

- Seeded violations may be "too clean" — real LLM-generated violations might be subtler or compound
- Does not capture violation types we didn't think to seed
- Mitigated by: including subtle single-violation variants in 25-file projects, and supplementing with a small set of real LLM-generated code in Phase 2

**Consequences**:

- Ground truth quality depends on the clean reference project being truly clean → requires manual verification
- Must document seeding methodology transparently in thesis for reproducibility

---

## ADR-009: CLI-first interface (not web UI, not library API)

**Status**: Accepted 

**Date**: 2026-03-27 

**Context**: The Firewall needs a user interface. Options: web dashboard, library/SDK, or CLI. 

**Decision**: Ship as a **CLI tool** (`firewall evaluate`, `firewall batch`) for v1. 

**Rationale**:

- Primary users (researchers) work in terminals and need scriptable, automatable evaluation
- Batch evaluation of 135 projects must run unattended — CLI with CSV output pipes directly into R/Python analysis scripts
- Minimal surface area to build and maintain for a thesis deliverable
- JSON output enables downstream tooling without coupling

**Interface Design**:

```bash
# Single project evaluation
firewall evaluate --project ./my-app --spec ./architecture.yaml
# Output: JSON report to stdout + human-readable summary

# Batch evaluation
firewall batch --dir ./generated/ --spec ./specs/ --output results.csv
# Output: CSV with one row per project

# Flags
--format json|human|csv    # Output format
--verbose                  # Include per-function detail
--neo4j-uri bolt://...     # Custom Neo4j connection
```

**Alternatives Considered**:

| Alternative | Why Rejected |
| --- | --- |
| Web dashboard | High effort; not needed for thesis; Could-Have for v2.0 |
| Library/SDK (npm package) | Useful but CLI can wrap the library; CLI covers all thesis use cases |
| VS Code extension | Narrow audience; requires different UX patterns |

**Consequences**:

- Neo4j must be pre-configured by the user (Docker Compose provided)
- No interactive visualization in CLI — users open Neo4j Browser separately for graph exploration
- Future: CLI can be wrapped by a GitHub Action (Could-Have v2.0) or a web API

---

## ADR-010: Stateless per-project evaluation (fresh graph per run)

**Status**: Accepted 

**Date**: 2026-03-27 

**Context**: Should the APG persist across evaluations (append mode) or be rebuilt fresh each time? 

**Decision**: Each evaluation creates a **fresh Neo4j graph** for the target project, evaluates, and optionally clears it. Stateless by design. 

**Rationale**:

- Eliminates state contamination between projects in batch runs
- Guarantees determinism — no stale data from previous runs
- Simplifies error recovery: if a project fails mid-evaluation, just skip and move on
- Performance is acceptable: full pipeline (extract → ingest → evaluate → score) < 5 seconds per project

**Implementation**:

- Before each project: `MATCH (n) DETACH DELETE n` (clear graph)
- Ingest project nodes and edges
- Run fitness functions
- Collect results
- Repeat for next project

**Alternatives Considered**:

| Alternative | Why Rejected |
| --- | --- |
| Persistent multi-project graph | Risk of cross-contamination; complex cleanup; not needed for benchmarking |
| Separate Neo4j database per project | Overhead of creating/destroying databases; Community Edition limits concurrent databases |
| In-memory mode only | Loses Neo4j Browser visualization for debugging |

**Consequences**:

- Cannot do cross-project graph queries (e.g., "show me all projects where domain imports infrastructure") without a separate aggregation step
- Batch runs are inherently sequential per project (parallelization would require multiple Neo4j instances)

---

## ADR-011: 3×3 factorial experimental design for the benchmark

**Status**: Accepted 

**Date**: 2026-03-27 

**Context**: The benchmark (Phase 2) needs an experimental design that tests H3 (spec quality mediates compliance) with sufficient statistical power. 

**Decision**: **3 × 3 between-subjects factorial design**:

- **Factor 1 — Spec Quality** (3 levels): Formal (full AoC YAML), Semi-structured (architectural guidelines in natural language), Informal (no architectural guidance)
- **Factor 2 — LLM** (3 levels): Claude 3.5 Sonnet, GPT-4o, Gemini 1.5 Pro (or current equivalents at time of execution)
- **Sample**: 5 task specifications × 3 LLMs × 3 spec conditions × 3 repetitions = **135 projects**

**Rationale**:

- Two-way ANOVA on Spec Quality × LLM → AVR tests H3 directly
- 3 repetitions per cell control for LLM stochasticity (temperature > 0)
- 5 tasks provide diversity across project complexity and architectural patterns
- 135 projects is evaluable in ~12 minutes (< 5 sec each) — practical for iteration

**Statistical Analysis Plan**:

- **H3**: Two-way ANOVA with Spec Quality and LLM as fixed factors, AVR as DV. Report F-statistics, p-values, η² effect size. Post-hoc: Tukey HSD for pairwise comparisons.
- **H2**: Cluster analysis on per-dimension AVR vectors → identify failure patterns (e.g., "good structure, bad DI" cluster)
- **H4** (exploratory): Paired comparison on 20-project subset: APG detection vs. CodeQL detection. Report agreement % and cost ratio.

**Alternatives Considered**:

| Alternative | Why Rejected |
| --- | --- |
| 2 × 2 design (2 LLMs × 2 conditions) | Insufficient power; can't detect non-linear spec quality effects |
| Within-subjects (same task, all conditions) | LLMs don't have "memory" across calls — between-subjects is appropriate |
| More repetitions (5 per cell) | 225 projects; diminishing returns on power. Can escalate if effect size is small. |

**Consequences**:

- Semi-structured prompt calibration is critical — must pilot-test to ensure it's distinct from both Formal and Informal
- LLM selection may need updating if models are deprecated before execution
- 5 tasks must span diverse architectural patterns (layered, clean arch with DI, repository pattern) — task design is a significant effort

---

## ADR-012: Layer annotation via spec mappings (not ML classification)

**Status**: Accepted 

**Date**: 2026-03-27 

**Context**: Fitness functions need to know which architectural layer each code element belongs to (domain, application, infrastructure). How do we assign these labels? 

**Decision**: Assign `layer` and `role` properties via **deterministic mapping rules** defined in the AoC YAML spec (Layer A). Three mapping strategies, applied in priority order:

1. **Directory mapping**: `src/domain/**` → layer: domain
2. **Naming convention**: `*Repository` → role: repository
3. **Decorator mapping**: `@Controller()` → role: controller, layer: infrastructure

**Rationale**:

- Deterministic: same spec + same code = same annotations. Always.
- Transparent: the mapping rules are visible in the YAML — no black box
- Matches how architects actually prescribe structure: "domain code goes in src/domain", "repositories implement IXxxRepository"
- Spike validated: mapping rules correctly annotated all nodes in test projects

**Alternatives Considered**:

| Alternative | Why Rejected |
| --- | --- |
| ML classifier (Style Classifier) | Non-deterministic; would need training data; violates core principle for v1. Deferred to ISE module (v1.1) for implicit spec extraction. |
| Heuristic-only (no spec needed) | Too many false positives; different projects use different conventions |
| Manual annotation per project | Doesn't scale to 135 projects |

**Consequences**:

- Projects that don't follow standard directory structures need custom mappings in their spec
- Files that match no mapping rule get `layer: null` — excluded from layer-dependent fitness functions but included in universal metrics
- ISE (Implicit Specification Extraction) in v1.1 would auto-infer mappings for projects without explicit specs

---

## ADR-013: Universal health metrics computed independently of specs

**Status**: Accepted 

**Date**: 2026-03-27 

**Context**: Some architectural quality indicators don't require a spec — they're universally applicable (e.g., circular dependencies are always bad). 

**Decision**: Compute a set of **universal health metrics** from the APG regardless of whether a spec is provided:

- **Circular dependencies** (cycle count in IMPORTS graph)
- **Fan-out** (max outgoing IMPORTS per file)
- **Fan-in** (max incoming IMPORTS per file)
- **Abstraction ratio** (interfaces / (interfaces + classes))
- **Instability index** per module (fan-out / (fan-in + fan-out))
- **Orphan files** (files with no IMPORTS or IMPORTED_BY edges)

**Rationale**:

- Provides a baseline evaluation even without a spec — useful for ISE (Implicit Specification Extraction) scenarios
- These metrics are grounded in established software engineering literature (Martin's stability metrics, coupling analysis)
- Enables comparison of code quality dimensions that transcend specific architectural styles

**Consequences**:

- Universal metrics are NOT included in AVR/AHS (which are spec-dependent) — they're reported separately
- Thresholds for "healthy" values are configurable but defaults are based on industry heuristics

---

## ADR-014: Node.js + TypeScript for the Firewall implementation itself

**Status**: Accepted 

**Date**: 2026-03-27 

**Context**: The Firewall tool needs an implementation language. 

**Decision**: Implement the Firewall CLI in **TypeScript running on Node.js**. 

**Rationale**:

- ts-morph is a Node.js library — no FFI or subprocess overhead
- The Neo4j JavaScript driver is mature and well-maintained
- Single language across the tool and its analysis target — reduces cognitive overhead
- YAML parsing (js-yaml), CLI framework (commander/yargs), and CSV generation are all mature in the Node.js ecosystem
- Researcher (author) has deep TypeScript expertise

**Alternatives Considered**:

| Alternative | Why Rejected |
| --- | --- |
| Python | Would need subprocess calls to ts-morph or a Python TypeScript parser (immature). Neo4j driver is fine. |
| Rust | High performance but ts-morph has no Rust bindings; development speed matters for thesis timeline |
| Go | Same ts-morph binding issue; less ergonomic for AST manipulation |

**Consequences**:

- Performance ceiling is Node.js single-threaded — acceptable for < 5 sec/project but limits parallelism
- Future: could use worker threads for batch parallelism if needed

---

## Decision Log Summary

| **ADR** | **Decision** | **Status** | **Spike Validated** |
| --- | --- | --- | --- |
| 001 | TypeScript-only for v1 | Accepted | ✅ Spike 1 |
| 002 | ts-morph as extraction engine | Accepted | ✅ Spike 1 |
| 003 | Neo4j for APG storage + querying | Accepted | ✅ Spike 2 |
| 004 | AoC YAML with 3-layer structure | Accepted | ✅ Spike 2 |
| 005 | Purpose-built APG schema (5 nodes, 7 edges) | Accepted | ✅ Spike 1 + 2 |
| 006 | Fitness functions as parameterized Cypher | Accepted | ✅ Spike 2 |
| 007 | AVR + AHS scoring model | Accepted | ✅ Spike 3 |
| 008 | Seeded violations for ground truth | Accepted | ✅ Spike 3 |
| 009 | CLI-first interface | Accepted | — |
| 010 | Stateless per-project evaluation | Accepted | ✅ Spike 3 |
| 011 | 3×3 factorial experimental design | Accepted | — |
| 012 | Layer annotation via spec mappings | Accepted | ✅ Spike 1 |
| 013 | Universal health metrics (spec-independent) | Accepted | ✅ Spike 3 |
| 014 | Node.js + TypeScript implementation | Accepted | ✅ All spikes |