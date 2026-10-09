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

**Amendment (2026-10-08, v1.2E Build and Test, NFR-04)**: the schema above is the 2026-03-27 spike schema. The graph contract that v1.2E implements (U2, FR-09, FR-10, FR-21, FR-34; ADR-015 item 8; ADR-016 f) is **6 node labels and 9 relationship types**; the source of truth is `src/shared/types/enums.ts` (`NODE_TYPES`, `EDGE_TYPES`) with the property views in `src/shared/types/apg.ts`.

| Node label | Change | Notes |
| --- | --- | --- |
| **Package** | new (FR-09) | One node per external package or Node built-in that a file imports; `filePath ''`, property `scope` (`npm`, `node` or `@scope`); outside the mapped/unmapped file counts; never layer-annotated |
| **Method** | widened (ADR-016 f) | Interface members are Method nodes too, not only class members |
| File, Class, Interface, Function | unchanged | `:File` typing is what the universal orphan metric reads (FR-09) |

| Relationship | From → To | Change | Properties / notes |
| --- | --- | --- | --- |
| **IMPORTS** | File → File \| Package | widened (FR-09, FR-10) | Merged per file pair: `specifier`, `specifiers[]`, `line`, `lines[]`, `isTypeOnly`, `importedNames[]`; alias-aware resolution; External imports end at a Package node |
| **RE_EXPORTS** | File → File | new (FR-34; ADR-015 item 8) | Per-name barrel resolution: `specifier`, `specifiers[]`, `line`, `lines[]`, `exportedNames[]` (`['*']` for `export *`), `isTypeOnly`; dependency rules and the cycle query traverse `IMPORTS\|RE_EXPORTS`, coupling metrics stay IMPORTS-only (BR-U1-36) |
| **FLOWS_TO** | Class → Class \| Interface | new (FR-21) | Field-type data flow within the D8 scope: `field`, `via` (`new` or `field-assignment`), `line`; constructor parameters stay CONSTRUCTOR_INJECTS |
| **CONSTRUCTOR_INJECTS** | Class → Interface \| Class | unchanged | Read together with FLOWS_TO by `domain-state-purity` (BR-U2-30) |
| **CALLS** | Method/Function → Method/Function | unchanged | |
| **CONTAINS** | Class → Method; **Interface → Method** | widened (ADR-016 f) | Interface members (e.g. variant-b `ITaskRepository` has 8) |
| IMPLEMENTS, EXTENDS, DECLARES | unchanged | | |

The rationale line "5 node types + 7 edge types" reads as "6 node types + 9 edge types" from v1.2E on. The spike validation statement refers to the 17 functions of the spike, not to the v1.2E catalogue.

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

## ADR-015: Evaluation-readiness design decisions for the spec compiler and graph extractor (v1.2, lane 2)

**Status**: Accepted

**Date**: 2026-10-07

**Context**: The v1.2 evaluation-readiness cycle must make DaedalusArch produce the results the thesis objectives promise. Those are: style libraries (SO1); APG coverage and latency (SO2); symbolic structural/topological rules plus a neural judge yielding AHS (SO3); P/R/F1 on a seeded golden dataset (SO4); and the LLM × spec-quality study (SO5). The U0 golden baseline at `7cd15b4` (`tests/golden/CHANGES.md`) showed that 7 of 24 checks never execute and that 3 of 5 fixture verdicts disagree with the spec header. The functional-design plans for U1 (spec + compiler) and U2 (extractor + graph) asked 41 design questions. An adversarial review (`aidlc-docs/construction/plans/v1.2E-lane2-functional-design-adversarial-review.md`) attacked every recommended option. The author asked for the decisions to be selected by one criterion: **does the choice change whether the promised results can be produced and defended?** Everything else takes the default recommended option.

**Decision**:

*Measurement policy (pre-registered before any FR-18 re-baseline or corpus run)*

1. **Fix vs observe rule.**
   - Fix internal spec/template inconsistencies and rules applied to the wrong architectural style.
   - Never tune thresholds or verdict cut-offs to data.
   - A check that cannot fire is either fixed, or excluded from the denominator and declared.
   - The five fixtures are the development set; the corpus is held out.
   - Every fix is one commit with one `tests/golden/CHANGES.md` line, dated before the first corpus run.
2. **Frozen before the first run**, each with a threats-to-validity entry:
   - the `pattern` grammar (glob over the class name with `|` alternation);
   - the `layered` applicability table;
   - the cycle-length bound (10);
   - the operational tag definitions (item 9);
   - the self-spec deviations from preset defaults.

*Corpus and provenance*

3. **Corpus = the five projects in `Docs/corpus.md`.** dev-nest receives its spec in the open-source mapping step (E7). `demo-target` is not part of the corpus.
4. **Corpus specs are versioned in this repository.** They are committed unchanged first (e.g. `corpus/specs/<project>.yaml`). The FR-22 migration (`intent` → `integrity`) is a separate, scripted commit.

*Correctness of results*

5. **Cycle query** (U1 Q15, U2 Q12):
   - the path bound is a literal compiler constant (Neo4j rejects a parameter there);
   - rotations are canonicalised with a pushed-down `ALL(...)` predicate;
   - `WITH DISTINCT` comes before `ORDER BY`;
   - truncation is detected with a `LIMIT cap+1` sentinel;
   - the universal cycle metric (`universal-metrics.ts`) uses the same bound;
   - a latency gate runs on the largest corpus project, with in-memory SCC (Tarjan) as the pre-agreed fallback.
6. **`intent` migration** (U1 Q9): the weight key `intent` maps to `integrity`; the dimension alias `intent` maps to `semantic`; a collision rule is defined; a test asserts that nothing compiled carries `intent`.
7. **Unresolved bare specifiers** (U2 Q2): before an import is classified as an unresolved alias, check whether a package by that name is installed. `paths` aliases that point into `node_modules` are treated as Package. This prevents dropping real external dependencies (truthy-demo `config`, dev-nest).
8. **Re-exports in dependency rules** (U2 Q6, new U1 Q25):
   - `dependency-direction`, `no-layer-skip`, `no-domain-outward-dep` and the cycle query traverse `IMPORTS|RE_EXPORTS`;
   - they return `type(i)` and `coalesce(i.isTypeOnly, false)`;
   - IMPORTS messages stay byte-identical, and only RE_EXPORTS rows say "re-exports";
   - coupling metrics stay IMPORTS-only.
9. **Template tags** (U1 Q14), by operational definition:
   - **structural**: a single typed edge checked against the layer model, with no name heuristic;
   - **topological**: path, degree, connectivity or ratio;
   - **pattern-proxy**: name, role or count heuristic.

   FR-29 is amended only where this definition requires it (`no-layer-skip` → structural).
10. **Construct-validity corrections** under rule 1:
    - FF-CV02 pattern becomes `*Service|*UseCase` (the template selects both roles; U1 Q21);
    - FF-S03 `no-layer-skip` applies to `layered` only; strict adjacency contradicts Clean Architecture's dependency rule (U1 Q22; Martin 2017; Buschmann et al. 1996); nestjs is decided explicitly in the U1 design;
    - checks that cannot fail at the re-baseline (FF-SO02, FF-CV01) are fixed or excluded and declared (U1 Q20);
    - a per-function sensitivity check in Build and Test proves that each check can fire on a seeded fixture.
11. **Requirements met rather than reworded**:
    - FR-19: the self-spec marks `core-modules` as `kind: infrastructure` (U1 Q3);
    - FR-20: runs report declared, compiled and executed counts, so "100 % executed" has a visible denominator (U1 Q6).

*Attribution*

12. **Merge order U2 → U1** (U1 Q24). U2 alone changes no golden snapshot, so every interaction delta lands in the U1 commit that causes it.

*Defaults*

13. All other questions take the recommended option A of their plan. The adversarial review's remaining conditions are optional refinements; they are adopted only where code generation needs them to work.

**Rationale**:

- Each selected item either changes a number reported against SO2–SO4, prevents a run from failing (FR-36 rejects on timeout), or keeps the Chapter 4/7 "requirement met" and "structural and topological rules" claims defensible.
- Pre-registering the fix/observe rule and the frozen choices separates corrections of the instrument from tuning to the data. That separation is the main threat an examiner will probe.
- Versioning the corpus specs and keeping one cause per snapshot change keep every reported figure reproducible and attributable.

**Alternatives Considered**:

| Alternative | Why Rejected |
| --- | --- |
| Take every recommended option A unchanged | Cycle query does not compile; Integrity weight collapses to 0; real external imports dropped; FF-S03/FF-CV02 bias precision on the correct reference |
| Adopt all 34 conditions of the adversarial review | Most do not change a promised result; schedule cost on a 25–30 day plan |
| "No calibration change" for everything (observe only) | Leaves known construct defects in every score; P/R/F1 would measure spec bugs |
| Merge order "whoever is second re-runs" | Joint deltas become unattributable to either unit |

**Consequences**:

- U1 gains Q25 (RE_EXPORTS traversal) and the construct corrections. Golden snapshots will change in U1 by design, each change attributed in `CHANGES.md`.
- U2 must merge before U1. Both can still be designed and coded in parallel.
- U3 inherits the bounded universal cycle metric and the orphan/barrel filters. U4 inherits the rubric and naming obligations.
- The thesis reports the pre-registered rule, the frozen choices and their sensitivity (e.g. the correct-reference verdict around the 0.80 cut-off) as threats to validity.
- References: `v1.2E-u1-spec-compiler-functional-design-plan.md`, `v1.2E-u2-extractor-graph-functional-design-plan.md`, `v1.2E-lane2-functional-design-adversarial-review.md`, `tests/golden/CHANGES.md`.

---

## ADR-016: Lane-2 functional-design settlements (v1.2)

**Status**: Accepted

**Date**: 2026-10-08

**Context**: The U1 (spec + compiler) and U2 (extractor + graph) functional designs left open items that the plan answers did not decide (U1 `business-logic-model.md` §9.2: OI-4, OI-5, OI-6, OI-8, OI-9, OI-11; U2 `business-rules.md` §14: OI-7, OI-10, and the derived settlements S-1 to S-7 and S-9). The author delegated these decisions under the standing approval of 2026-10-08 (`aidlc-docs/audit.md`). Each is settled by the ADR-015 criterion: **does the choice change whether the promised results can be produced and defended?** The full record, with the requirement amendments these designs need, is `aidlc-docs/construction/plans/v1.2E-lane2-functional-design-clarifications.md`.

**Decision**:

a. **NestJS controllers** (U1 OI-4). `naming-controllers` (FF-CV04) and `controller-no-entity` (FF-P05) bind the presentation layer, where NestJS controllers live (`presets/nestjs.yaml:78-98`). This fixes a rule applied to the wrong style under ADR-015 item 1. Realisation (U1 BR-U1-46): a new binding `controllerLayer` = the presentation layer when the layer model has one, else `infraLayer`. Clean-architecture specs, the self-spec and the five fixtures have no presentation layer, so their binding and golden snapshots do not change.
b. **Checks that cannot fire** (U1 OI-5; ADR-015 items 1, 10). FF-CV01, FF-CV04 and any other check that cannot fire are decided by the per-function sensitivity check in Build and Test. If the template can be made to fire on a seeded fixture, it is fixed. Otherwise it is excluded from the denominator and declared (`enabled: false` plus `reason`, visible in `disabledFunctions`).
c. **Compiler warnings** (U1 OI-6). Warnings for functions disabled by style or kind (`COMPILER_004`) are routed into reports by U3 (FR-13/FR-14). U1 prints the counts in `validate` only.
d. **Business-layer forbidden imports in `layered`** (U1 OI-8). `presets/layered.yaml` business-layer `forbidden_imports` = the FF-P01 `forbidden_imports` list of `presets/clean-architecture.yaml` (`@nestjs/*`, `typeorm`, `express`, `prisma`, `@prisma/*`, `sequelize`; no Node built-in).
e. **Cycle-query latency budget** (U1 OI-9; ADR-015 item 5; NFR-07). Each cycle query (the FF-S02 template and the universal cycle metric) completes within **30 s** on the largest corpus project (ghostfolio `apps/api`). Otherwise the pre-agreed in-memory SCC (Tarjan) fallback replaces both.
f. **Interface→Method `CONTAINS`** (U1 OI-11). U2 emits Method nodes for interface method signatures and `Interface -[:CONTAINS]-> Method` edges, so FF-SO02 `interface-segregation-proxy` can fire. This is accepted into U2's scope (U2 BR-U2-47). The U1 exclusion fallback for FF-SO02 (BR-U1-39) applies only if U2's acceptance check fails at FR-18.
g. **Universal orphan metric** (U2 OI-10). No layer filter: the metric stays spec-independent (ADR-013). The barrel filter and the `:File` typing on `IMPORTS|RE_EXPORTS` in both directions apply. The `no-orphan-files` template keeps its existing `f.layer IS NOT NULL` filter, because it is a spec-bound check.
h. **Scout probe script** (U2 OI-7). U2 code generation commits the probe script and its output under `Docs/DiagnosticRuns/`, so the corpus figures quoted in the U2 design are reproducible.
i. **U2 derived settlements** S-1 to S-7 and S-9 (U2 `business-rules.md` §14.1) are confirmed as written. S-8 is unused.

**Rationale**:

- a and b remove construct defects before the first corpus run without tuning a threshold (ADR-015 item 1). Without a, both controller checks are vacuous on every corpus project (all `style: nestjs`). Without b, a check that cannot fail would inflate every AVR denominator.
- c keeps FR-20's visible denominator honest in the report rather than only on the CLI.
- d gives FR-20's business-layer list a stated source instead of an ad hoc one. No fixture result depends on the values.
- e states the NFR-07 budget before the run, so the fallback decision cannot be made after seeing results.
- f makes the seeded fat-interface violations (variant-b, variant-c) detectable, which changes P/R/F1 against the manifests (SO4).
- g keeps ADR-013's spec-independence: a universal metric that read the spec's layer mapping would no longer be universal.
- h and i make every quoted figure and every derived rule traceable.

**Alternatives Considered**:

| Alternative | Why Rejected |
| --- | --- |
| a: exclude and declare both controller checks for nestjs | Loses two checks on every corpus project when a binding fix exists |
| a: bind `presentationLayer` unconditionally | Clean-architecture specs have no presentation layer, so the checks would disable there and the golden snapshots would move without cause |
| f: exclude FF-SO02 everywhere | The seeded fat interfaces in variant-b and variant-c would be missed by construction |
| g: add `f.layer IS NOT NULL` to the universal metric | Makes a universal metric depend on the spec (contradicts ADR-013) |
| e: no fixed budget, decide at the run | Post-hoc choice of the fallback; examiner-visible threat |

**Consequences**:

- U1 gains BR-U1-46 (`controllerLayer`, commit K16, no fixture delta). Its golden table changes at K2: FF-SO02 fails on variant-b and variant-c once U2's `CONTAINS` edges exist (AHS estimates b .562 → .528, c .408 → .374 at K2; final .595 and .412; verdicts unchanged).
- U2 gains BR-U2-47 (interface Method nodes and `CONTAINS` edges). U2 alone still changes no golden snapshot, because FF-SO02 is not executed before U1 K2 binds `maxInterfaceMethods`.
- U3 inherits compiler-warning routing (c) and the universal orphan metric without a layer filter (g).
- Build and Test inherits the sensitivity check (b) and the 30 s latency gate (e).
- References: `v1.2E-lane2-functional-design-clarifications.md`; U1 and U2 `functional-design/` folders; ADR-013; ADR-015.

---

## ADR-017: Scope and requirement amendments for producing the thesis results (v1.2, lanes 3–4)

**Status**: Accepted (author, 2026-10-08: "accept all")

**Date**: 2026-10-08

**Context**: The functional-design plans for U3, U4, U5a and U5b raised escalations. Each one either changes requirement text or revisits an earlier ADR. The author accepted every recommendation.

**Decision**:

1. **Corpus.** The five projects in `Docs/corpus.md` remain the frozen core (ADR-015 item 3). E7 adds 3–5 further open-source projects, selected under criteria dated in git before any run, to reach 8–10 projects.
2. **SO5 in scope.** The SO5 deviation wording is removed from the requirements. The generator (FR-28) is built, and E1 is run.
3. **ADR-011 superseded.** The 3×3 / 135-project design is replaced by the parametric E1 grid: 3 Claude models × 3 spec levels × 2 tasks × 3 runs = 54 projects. Gemini, Antigravity and Codex adapters are added at the end.
4. **SO4 seeding floor.** To reach 80–120 seeded instances, one uniform scripted remap of the corpus specs' domain layer (`**/domain/**`, `**/*.entity.ts`) is applied. It is a spec correction under ADR-015 item 1, committed and dated before any corpus run, and recorded in `Docs/corpus.md`.
5. **FR-11.** `domain-purity` traverses `IMPORTS|RE_EXPORTS` and returns `type(i)`, consistent with ADR-015 item 8.
6. **FR-25.** "per-tier" becomes "per tag (FR-29)".
7. **FR-27.** Agreement is reported run vs run, judge vs panel, and panel vs the author's 30-item audit. A single labeller has no labeller-vs-labeller agreement.
8. **SECURITY-11** is enforced on the generator: restricted tool list and a confined output directory.
9. **U4 halt condition.** If the subscription login cannot be used from a dedicated `CLAUDE_CONFIG_DIR`, U4 halts and the author chooses the route.

**Rationale**: Each item is needed to produce, or honestly report, a result promised in SO1–SO5. Requirement text is amended in `v1.2-evaluation-readiness-requirements.md`, with dated notes, instead of being silently reinterpreted.

**Alternatives Considered**:

| Alternative | Why Rejected |
| --- | --- |
| Keep SO5 as a deviation | The objective promises the LLM × spec-quality taxonomy |
| Seed only into generated projects | Makes SO4 depend on E1 output quality |
| Lower the SO4 number | Changes an objective sentence |

**Consequences**: ADR-011 is marked superseded. Lane 3 (U3, U4, U5a) and lane 4 (U5b) are designed against these amendments. The experiments run after Build and Test.

---

## ADR-018: Judge config-directory allow-list after the Gate H probe (v1.2, U4)

**Status**: Accepted (orchestrator under the 2026-10-08 standing approval; ADR-015 item 1 criterion)

**Date**: 2026-10-08

**Context**: Gate H passed H1–H5 (plan Step 6, commit `8bbd2cc`). The probe found that the real judge config dir does not match the BR-U4-ISO-04 allow-list:
- `/login` auto-installed the official plugin marketplace (`plugins/**`, about 786 entries).
- The CLI creates `settings.json`.
- Each call creates `projects/<cwd>/memory`, even with `--no-session-persistence`.
- The CLI auto-updated from 2.1.293 to 2.1.294 during the login.

**Decision**:

1. **`plugins/` stays forbidden.** It was removed from the judge dir. A judge call afterwards succeeded (`is_error` false), and nothing was recreated. If `plugins/` reappears, the run-time check fails closed, and the operator removes it. No re-login is needed, because the credentials live in the keychain.
2. **Allow-list additions** (anchored globs; no pattern may match `plugins/`, `settings.local.json`, `CLAUDE.md`, `agents/`, `commands/`, `skills/`, `hooks` or `.mcp.json`):
   - `.last-cleanup`
   - `.last-update-result.json`
   - `backups/.claude.json.backup.*`
   - `sessions/<digits>.json` and `sessions/<digits>.*.key`, matched with digit classes rather than `*`, so `sessions/settings.json` is not matched
   - `projects/*` and `projects/*/memory`, allowed only as empty directories; any file under them fails the check
   - `cache/**`
3. **`settings.json` is allowed with a content rule.** The check parses the file and logs only key names. It fails closed unless the top-level keys ⊆ {`theme`, `env`} and the `env` keys ⊆ {`DISABLE_AUTOUPDATER`}. Today the file holds only `theme`.
4. **Version pin.** `PINNED_CLI_VERSION` = 2.1.294. `DISABLE_AUTOUPDATER=1` joins `JUDGE_ENV_ALLOW` and is set in the judge child env. Every run checks `claude --version` against the pin and fails closed on a mismatch. The manifest records the version.
5. **Error classification.** It uses `is_error` plus the result text, never `subtype`; an auth error reports `subtype: success`. The `USAGE_LIMIT` patterns stay marked unverified until a natural sample is seen.
6. **Canary residual.** The ancestor-`CLAUDE.md` channel was positively controlled; the user-level `CLAUDE.md` and hook channels were not. Credentials are tied to the real home, so a throwaway home cannot log in. This is recorded as a residual threat to validity and repeated in Build and Test. No edit to the author's real config is made without consent.

**Rationale**: These changes keep ISO-04 fail-closed while matching what the pinned CLI actually writes. Requirement text is unchanged. Only the frozen allow-list values, which the plan marks [PROBE], are filled in.

---

## ADR-019: Build and Test escalations E-1, E-2 and the labeller route (v1.2)

**Status**: Accepted. Items 1 and 4 are the author's decisions of 2026-10-08. Items 2, 3, 5 and 6 are orchestrator settlements under the standing approval.

**Date**: 2026-10-08

**Context**: Build and Test stopped at Step 49 with three issues open:
- **E-1:** SO4 held-out capacity is 69 at k = 3, below the floor of 80 (BR-U5a-37 `CAT_SHORTFALL`). ghostfolio-test fails its type-check, so the usable count is 54.
- **E-2:** SEN-01 for FF-N02 needs 35 live calls, but the orchestrator's session cap of 40 calls leaves too few.
- **Labeller route:** the Gemini API key in `.env` is rejected (`API key not valid`).

**Decision**:

1. **SO4 floor (author).** Freeze E7 at the maximum of five projects, selected under the dated `Docs/corpus-criteria.md`. Give each a spec before any run, then recount under BR-U5a-37 as written, which already counts frozen E7 bases. If the total at k = 3 is still below 80, freeze k = 3, run SO4 with the actual N, and report the shortfall as a deviation in Ch7. No other lever is used: no k = 4 and no relaxed counting.
2. **Base preparation.** An excluded base may be repaired only by a documented, deterministic preparation step that changes no source file, applied before the catalogue freeze. For ghostfolio-test this means `prisma generate` and the monorepo-root `tsconfig.base.json`. If the base still does not type-check, it stays excluded (BR-U5a-07) and does not count toward k.
3. **E7 specs (OI-12).** E7 specs are written from the style presets under the ADR-015 item 1 rule. The additive `prereg.json` bump that registers them is a dated registration, not a deviation, provided it is committed before any run on those projects.
4. **Labeller route (author).** The panel runs through the installed Gemini CLI, signed in with the author's Google account, in place of the API. This needs:
   - a CLI adapter with the same strict-verdict contract as the API provider;
   - an isolation probe modelled on Gate H: no tools, no extensions or MCP servers, no ambient `GEMINI.md`, a dedicated config home, a pinned CLI version, and a model id verified on the CLI;
   - cassettes in record and replay modes.

   If the CLI cannot be isolated, live labelling halts and the author picks the route.
   - **Amendment (2026-10-08, the same day):** the `gemini` CLI 0.46.0 is refused for this account (`IneligibleTierError: This client is no longer supported for Gemini Code Assist for individuals`). The route is therefore the Antigravity CLI (`agy`, Homebrew cask `antigravity-cli` 1.1.23). Its flags are `-p`, `--model`, `--output-format json`, `--json-schema` and `--print-timeout`, and `agy models` lists `gemini-3.1-pro-high`. The author signed in with Google OAuth into the dedicated home `~/.firewall/labeller-agy-home` (mode 700). A clean `HOME` cannot see the author's `~/.gemini`, so it holds no ambient `GEMINI.md`, plugins or MCP servers. A headless call under `env -i` with that `HOME` and a neutral cwd returned `SUCCESS`. The isolation probe, the canary and the version pin still apply before any labelling.
5. **E-2.** The 40-call cap was an orchestrator budget, not a design rule. Build and Test's live-call budget is raised to 200 judge calls, logged in the live-call ledger. SEN-01 runs in full and excludes no function (ADR-016 b).
6. **Remaining settlements.**
   - **E1 `orderSeed` (OI-BT-F3):** fixed at the catalogue freeze as `20261008`.
   - **The ancestor-`CLAUDE.md` channel (OI-BT-F1):** blocked only by the ISO-05 neutral-cwd check. This is recorded as a threat to validity; no code changes.
   - **realworld-test install (OI-BT-C1):** the mirror failure is recorded. The base type-checks and passes parity, so it stays in.

---

## ADR-020: Methodology corrections before the experiment runs (P-2)

**Status**: Accepted (orchestrator, under the standing approval of 2026-10-08, and the author's instruction to use an adversarial Fable review on critical design)

**Date**: 2026-10-08

**Context**: A Fable-model adversarial review of the registered evaluation at `1185a1f` found ways the SO4 and SO5 figures could be misleading even though the registration machinery is sound. Every change below is committed as the dated pre-registration bump P-2, after P-1 and before any so4-heldout, e7-corpus, e1-grid or live-labelling run.

**Decision**:

1. **Baseline precision (A1).** A registered SO4 secondary outcome: the Horvitz–Thompson-weighted share of P2 baseline items labelled TP or unseeded-TP, per function and overall, with the BR-U5b-61 interval rule. Wherever "precision" is quoted, it is reported next to the differential precision. The differential figure is named "seeded differential precision".
2. **Label semantics (A2).** MAT-10 changes: FP-labelled = FP-strict minus {TP, unseeded-TP}. In the HT estimates, every TP-class label is weighted 1/p.
3. **Unit of analysis (A3).** The recall interval unit is the (project, operator) cell, with cell recall = detected / k. The project cluster bootstrap is co-primary. The instance Wilson interval is shown only as the "if independent" bound.
   - **Amendment (2026-10-09, P-M, registered before any run):** the project cluster bootstrap is co-primary **only with 10 or more projects**, the BR-U5b-61 cluster floor. With 2 to 9 projects it is reported but **descriptive**, flagged `ci_project_descriptive = true` (`Docs/analysis-plan.md` §5 and its 2026-10-09 amendment row; code commit `8353f3c`; registered by prereg v3). The reason: a percentile bootstrap over so few clusters undercovers (2 projects give a three-point resampling distribution). Consequence for SO4: `so4-heldout` has 7 projects, so the cell-level interval is the only primary recall interval, and between-project dependence enters no primary interval. It is reported in the descriptive `ci_project_*` column and named as a threat in the write-up.
   - **Open option, not adopted (author decision):** a small-cluster project-level primary interval, either a cluster-robust t interval on project recall with df = projects − 1 or a BCa bootstrap, would let a project-level interval stay primary with 7 projects. Adopting it changes `Docs/analysis-plan.md` §5, a registered artefact, so it would need its own prereg bump before any so4-heldout run.
4. **E7 specs (A4).** They are generated by a registered, mechanical directory-to-layer rule committed before a single feasibility count, and are never edited afterwards. The remap and the E7 specs are declared as floor-motivated.
5. **Symbolic SO4 (A5).** `so4-heldout` runs in symbolic-only mode. Neural results, where run, go in their own column and never enter symbolic P/R/F1.
6. **SO5 inference (A6).** Pairwise bootstrap CIs are descriptive only. Inference rests on Holm-corrected permutation p-values and Cliff's δ.
7. **Self-preference (A7).** Judge-vs-panel agreement is reported per generator model and per source (fixtures vs E1), with E1 only as the headline. `ahsDeterministic` is co-primary with `ahsCombined` for the model effect. The directional check (an Opus advantage on `ahsNeuronal` relative to `ahsDeterministic`) is pre-registered.
8. **Unseen stratum (A8).** E7 is the only unseen stratum. A pooled E7 row is reported next to the all-bases figure.
9. **Reporting duties (B1–B7)** are registered in `Docs/analysis-plan.md` §"Reporting duties":
   - recall is framed as construct sensitivity, with template coverage and all-nestjs core reported;
   - twin specificity is by construction;
   - the panel is one model run twice (order sensitivity), with `uncertain` kept as a category and an approximate weighted CI;
   - FPAT is a pre-specified rule-family profile, not a derived taxonomy, unless an exploratory coding of rationales is added with the author declared as a non-blind coder;
   - in `full-aac` the generator sees the evaluator spec, so the level is confounded with test knowledge; one vendor only;
   - the author audit is a sanity check and is not blind to the rule;
   - housekeeping: the unused `remapLine`, the TBD catalogue hashed in v1, the post-hoc ghostfolio repair, MAT-25 rejection counts, and secondary families as exploratory.

**Rationale**: Without items 1–3, the headline SO4 numbers would be a precision of about 1.0 by construction, a recall CI roughly √3 too narrow, and a label rule that moves real violations into FP. All of this is fixable before any run.

---

## ADR-021: Objectives-readiness audit and the U6 integration unit (v1.2)

**Status**: Accepted (orchestrator, standing approval 2026-10-08)

**Date**: 2026-10-08

**Context**: A read-only audit ran six lenses (SO1–SO5 and threats), adversarially verified each finding, then ran a completeness critic. It confirmed 44 gaps: 10 blocking, 30 major, 4 minor. The verified list, with evidence, is `Docs/DiagnosticRuns/so-readiness-audit-2026-10-08.json`. Most gaps are missing connections between pipeline stages that already exist. Without them the promised Ch7–9 outputs cannot be produced.

**Decision**:

1. **New unit U6, Integration.** It owns every audit finding except the ones ADR-020 (P-M) already covers: SO4-07 = A5; SO5-06 and THR-1 = A7; X-1, which P-M implements. U6 also integrates the agy labeller adapter (SO3-1, SO4-08, SO5-09), together with the labeller lane.
2. **Settlements:**
   - **SO1.**
     - Add the FR-20 layered acceptance run on a public layered E7 project, written to `results/pre-tag/`.
     - Add a style column to the strata and to `denominators.csv`.
     - Register `specs/clean-arch.yaml`, the layered fixture spec and `presets/*.yaml` as artefacts.
     - Register SO1 metrics, all scripted: spec validator first-pass rate, template coverage per library, spec line counts.
   - **SO2.**
     - A cycle-query timeout counts as `fallback-required`.
     - Time the universal cycle metric.
     - `latency.csv` and the NFR-07 table are written by script.
     - Register a data-flow edge coverage metric, `FLOWS_TO` edges per resolved import, plus per-project graph-size rows.
     - The APG-full vs AST-only ablation is delivered cheaply: an extractor flag, then the violation difference on the corpus and the fixtures. The flag is the register's edge-type allow-list (IMPORTS, DECLARES, CONTAINS on the full extraction), as amended by item 8.
   - **SO3.**
     - Build a label-plan producer covering P1–P4 and MS items.
     - Build a `--judge-verdicts` producer.
     - Fix the label-shape adapters (SO4-01, SO5-01).
     - Add `projectId` to the judge repetition keys.
     - Register the labeller route, model id and CLI version.
     - Labeller validity criterion: if run-vs-run κ < 0.60, the FP/FN taxonomy is reported as descriptive only.
     - agy offers no temperature setting, which is recorded as an amendment to the determinism rule.
     - The audit view hides panel labels and is shuffled with a seed (THR-3).
     - Weighted-agreement CIs use a weighted item bootstrap (THR-6).
   - **SO4.**
     - Add a run-to-score-case adapter.
     - A rejected pair is listed with its reason and does not stop the run.
     - Register the 80–120 floor and the ADR-019 shortfall reporting, with an N-vs-floor output.
     - Precision and F1 get intervals: cluster bootstrap, with Wilson for precision as the "if independent" bound.
   - **SO5.**
     - Commit and hash the generator plan, including `orderSeed` 20261008 and the pinned model ids.
     - Resume mid-cell by an atomic restart of the cell.
     - A missing cell is recorded as not-run with a GEN code.
     - Add LOC, density per KLOC and per-project latency.
     - Register an exploratory open-coding procedure: the agy panel proposes codes from the rationales, and the author, declared non-blind, consolidates them. It is never confirmatory.
     - Make a pre-run judge-volume estimate for E1.
     - Permutations are restricted within the strata of the other factor (THR-4).
   - **Docs.**
     - A registered threats-to-validity register (THR-9).
     - Figure specs for SO2, SO4, SO5 and the threshold sweep (X-5).
     - Naming (X-6): the ADR-020 bump is "P-M"; "P-2" stays the B&T cycle-strategy flip.
3. **The H13 latency gate (BT-D) moves to U6**, so the gate's fixes come before its first run.
4. **Registration.** Every U6 change to a registered artefact goes into one dated bump, P-U6, after P-1 and P-M and before any so4-heldout, e7-corpus, e1-grid or live-labelling run. The final pre-run check of P-U6 is reviewed by a Fable adversarial verifier.
5. **P-U6 additions from the Fable verification of P-1 (2026-10-09; verdict PASS with no blocking issues; the record is `Docs/DiagnosticRuns/p1-verification-2026-10-09.md`).**
   - **Major 1:** the registered plans must name the held-out set.
     - Write the seven held-out `{projectId, path, specPath}` entries into `experiments/so4-heldout/plan.json`: realworld, ghostfolio, truthy-demo, dry-run-test, zhuravlevma, nestjslatam, valex.
     - Add the three E7 bases to `experiments/e7-corpus/plan.json`.
     - Update the run list in `Docs/analysis-plan.md`, and add its Reporting duties section if P-M has not already done so.
   - **Major 2:** register the count inputs. Commit the `--bases` list used for the count, or record the exact command lines in `u5a-site-feasibility.md`. Add these to `REGISTERED_ARTEFACTS`, without rerunning any count:
     - `Docs/DiagnosticRuns/u5a-site-feasibility.json`
     - `u5a-base-typecheck.json`
     - `e7-spec-generation.json`
     - `corpus/selections/*.json`
   - **Minor:** also register `presets/*.yaml`, `generate-e7-specs-cli.ts` and the three chain tools (`migrate-corpus-spec`, `remap-domain-layer`, `corpus-rubric-u4`).
   - **MarvinRF stays excluded from SO4 for good.** Re-admitting it would need a second feasibility count. If the zero-judge-units schema defect is fixed, MarvinRF may be reported only as an exploratory extra.
   - **Ch7 reporting duties 1–9 from that verification are binding.** They cover the full capacity history (29/42, then 47/69, then 85/126), the three floor-motivated decisions with their arithmetic, the counterfactual (N = 111 at k = 3 on six bases without the ghostfolio repair), the exclusions by name, the style mismatches and imbalance, the vocabulary written after the projects were known, and the 85-vs-80 margin.
6. **Labelling budget (2026-10-09, after PR #21).** The agy route measured about 60 s and 74k–124k input tokens per label call. Two calls used about 1.1% of the weekly and 2.6% of the 5-hour Gemini quota, so about 180 calls fit in a week. The registered ceiling of 4000 calls is a cap, not a requirement. The U6 label-plan producer must therefore:
   - size every stratum explicitly and register the sizes in P-U6. The whole live labelling plan, both runs included, must fit in 300 calls or fewer, spread over at least two weeks of quota.
   - cut the context to what the labeller needs: the 31-line window plus the rule text and the verdict schema. Measure the input tokens per call and record them.
   - compute the CI widths that the registered sizes give, and report them, so the precision of FP/FN and agreement is stated before any run.
7. **The prereg gate is currently refused, and P-U6 must clear it (2026-10-09, from the P-M verification).** On `444439b`, `--check-prereg` refuses all six plans: `Docs/generator-protocol.md` changed after v3, and `experiments/e1-grid/generator-plan.json` is not registered. P-U6 must:
   - register both files, with reasons, and bump the prereg version;
   - confirm that every plan prints "pre-registration v<N> ok";
   - then add a CI step that runs `--check-prereg` for every `experiments/*/plan.json` on PRs to v1.2e.
8. **Label-size corrections, to be implemented in P-U6 before the bump** (Fable review of PR #26, 2026-10-09, verdict CONDITIONAL; record in `Docs/DiagnosticRuns/label-sizes-review-2026-10-09.md`):
   1. **P3 is dropped from live labelling.** Set `maxItems` to 0. Label-dependent `fpat_*` per-cell values become N/A (undefined, never 0), and Ch9 reports the FPAT profile from symbolic counts only. P3's calls go to P2.
   2. **No refusal on overflow.** Add a pre-committed escalation rule: when P1 + MS exceeds 135, `budgetCalls` grows in whole weeks of 180 calls, up to `maxWeeks` = 4 (720 calls), before any sampled ceiling is lowered. State the basis for the P1 + MS projection, taken from the fixture or spike FP counts.
   3. **Effective n per row.** `precisionStatement` prints the Kish effective n and its half-width per row: E1 headline (n = 36), fixtures, per generator, and P2 overall. P2 is drawn with probability proportional to stratum size, so it is self-weighting. Correct analysis-plan §4 to match.
   4. **Intervals for κ.** κ and AC1 get confidence intervals from the same weighted item bootstrap, in `kappa_ci_low` and `kappa_ci_high` columns. The κ < 0.60 rule is judged on the point estimate, with the interval reported beside it.
   5. **Audit seed.** `seeds.audit` is registered in `corpus/label-plan-config.json` and carried into the plan. A different `--seed` is refused.
   6. **Labeller context.** The context ceiling is set per kind; a judge unit gets about `codeSnippet` × 4 characters. Report `context.cut` by kind. The information asymmetry between labeller and judge is stated in the threats register.
   7. **Call counting.** The budget counts agy invocations, retries included.
   8. **Label-blind audit.** The 30-item audit is drawn from the plan, stratified by kind × population, before the live labelling run. Excluding `uncertain` items no longer applies.

   **Small-cluster interval decision:** with 7 projects, the project cluster bootstrap is descriptive only (ADR-020 item 3 amendment). The cell-level interval stays the sole primary recall interval. No cluster-robust t or BCa interval is added.

   **Build and Test:** BT-B, BT-E and BT-F resume only after P-U6, because their entry gates need `--check-prereg` to pass.

   If 300 calls cannot support FR-27, the gap is reported as a limitation. The judge-vs-panel agreement (P4) takes priority over the P2 baseline-precision sample, and P2 over P3.
8. **SO2 follow-up (2026-10-09, review of PR #23).**
   - **AST-only arm = the register's definition.** PR #23 built `--graph-mode ast-only` as "drop `FLOWS_TO` and `RE_EXPORTS`, resolve no alias (`paths`, `baseUrl`) and follow no barrel", from the item 2 wording. That is not the ablation the compliance register (row SO2-5) and the audit (SO2-5, X-2) define: "only IMPORTS, DECLARES and CONTAINS edges against the full graph". It kept CALLS, EXTENDS, IMPLEMENTS and CONSTRUCTOR_INJECTS, which come from the type checker. The review measured that it changed nothing on dry-run-test (IMPORTS 698 and resolvedInternal 409 in both arms). On truthy-demo, which imports through `baseUrl`, it collapsed the internal import graph (resolvedInternal 398 to 0), so there the arm measured `baseUrl` resolution, not AST-only extraction. **Decision:** `ast-only` is now the allow-list. It is a pure post-filter (`restrictToGraphMode`, `src/apg-extractor/graph-mode.ts`) over the unchanged full extraction. It keeps the IMPORTS, DECLARES and CONTAINS edges and the Package nodes that a kept edge targets. Import resolution, the counts and the FLOWS_TO accounting stay those of the full extraction. This is the registered definition, so the requirements deviation list gains no entry. A pre-run check, `so2-metrics arms --plan experiments/apg-ablation/plan.json`, exits 1 when any base's pair of arms is identical (per base, naming the bases; tightened from "no pair differs" after the SO2 re-review). On 2026-10-09, with each spec's `default_exclude_paths` (next bullet but four), all nine pairs differ (edges removed: realworld-test 32, ghostfolio-test 1012, truthy-demo 142, dry-run-test 159, fixtures 4 to 7), and resolvedInternal is equal in both arms.
   - **MO-DF01 seeds in the ablation:** not added in this follow-up. FLOWS_TO edges in the unseeded inputs are few (variant-a 1, variant-c 1; the four corpus bases 0 under their spec excludes), so FLOWS_TO-dependent functions can lose detection only on those. P-U6 decides whether `apg-ablation` adds the so4-heldout MO-DF01 seeded copies, once `so4-heldout` names its entries (item 5, Major 1).
   - **NFR-07 table source (SO2-3 a):** B&T plan Step 25 builds `nfr07_latency.csv` from `--run-dir results/latency-gate --run-dir results/apg-ablation`. Both are symbolic-only plans that run right after P-U6. The full-APG arm of `apg-ablation` covers the three in-scope bases (≤ 300 files), and `nfr07Rows` leaves out the AST-only arm. P-U6 must state this source in analysis-plan §3 SO2.
   - **Gate source (for P-U6 or the P-M lane):** `results/latency-gate/so2/gate.json` (`so2-metrics tables`) is the only registered H13 gate source. The aggregate's `latency.csv` (`scripts/aggregate.ts`, owned by P-M) is accepted-only. Its `gate_result` column cannot give `fallback-required` for a rejected run. Its `cycle_query_ms` now sums both cycle queries, and its per-stage rows include `universal-metric:cyclicDependencyCount`, which is already inside `compute-scores`, so summing `stage_ms` double-counts it. P-U6 or P-M must mark or exclude that sub-stage row, rename or document `cycle_query_ms`, and drop or label `gate_result` as non-registered.
   - **The measured graph is the evaluated graph (SO2-3, SO2-4, X-4).** `so2-metrics` `flows-to`, `arms` and `profile` first extracted without the spec's `default_exclude_paths`, which the pipeline passes to `ExtractCommand`. On truthy-demo that measured 155 files, 1167 edges, 398 resolved imports and 1 FLOWS_TO edge, where the evaluated graph has 131 files, 1009 edges, 307 resolved imports and 0 FLOWS_TO; the SCC and PROFILE rows of truthy-demo and dry-run-test covered `test/` and migration files the evaluation excludes. **Decision:** one C3 rule, `readSpecExcludePaths` (`src/spec-parser/exclude-paths.ts`), now gives the excludes to both `pipeline-factory` and every `so2-metrics` extraction (each plan entry's `specPath`, or `profile --spec`); an unreadable spec is `SO2_INPUT_INVALID`. ghostfolio-test's H13 PROFILE rows were not affected (it has no excluded files). `tables` and `ablation` report a bad `--run-dir` as `SO2_INPUT_INVALID`.
   - **BR-U5b-55 exemption:** `scripts/so2-metrics.ts` is a U6 measurement script, not a U5b harness script. `profile` needs a direct driver session to read `resultAvailableAfter` and `resultConsumedAfter`, and `arms` and `flows-to` measure the extractor itself. It therefore imports C1 `extractAPG`, C2 ingestion, C3 `parseSpec`, C4 `compileFunctions`, C5 `scc-cycles`, C8 `UNIVERSAL_METRIC_QUERIES` and `neo4j-driver` in-process. `tests/unit/scripts/so2-imports.test.ts` holds that whitelist. The pure `scripts/lib/so2.ts` and the CLI entry are held to BR-U5b-55 plus the C10 type lists. The harness (`run-experiment.ts`) re-declares `UNIVERSAL_CYCLE_STAGE` instead of importing a C8 symbol that is not listed, with an equality test, as it does for `PLAN_GRAPH_MODES`.

9. **SO4 lane (2026-10-09; SO4-03, SO4-04, SO4-05, SO4-06, SO1-C; the zero-judge-units schema defect).**
   - **Rejected pairs (SO4-03).** `score-golden` lists a pair whose run is missing, not accepted or fails acceptance or provenance (`SCORE_INPUT_REJECTED`), or whose FLOWS_TO evidence is unavailable (`EDGE_EVIDENCE_UNAVAILABLE`), in `GoldenScore.rejectedPairs` with its reason, and scores the rest (MAT-25, analysis-plan §8 as written). Two cases still refuse the whole score: a keyless operator collateral entry (`SCORE_COLLATERAL_UNKEYED`, a defect of the frozen instrument, not of a pair) and a case in which every pair is rejected. The manifest rejections are carried in `manifestRejections`.
   - **Run-to-score-case adapter (SO4-04).** `scripts/build-score-case-cli.ts --runs <outDir> --out <case>` copies a harness output directory into a case: records to `reports/<runId>.run.json`, reports at their recorded `reports/<runId>.json` paths, and the manifest every seeded record names (or `--manifest`). Nothing is filtered. **Convention for the `so4-heldout` plan entries:** a seeded entry's `seed.baselineReportPath` is `reports/<runId>.json` of the baseline entry of the same plan, where `runId = runIdOf(planId, entry)` is known before the run. P-U6 writes the entries in this form.
   - **N against the floor (SO4-05).** `golden_instances.csv` gives the golden-set count (BR-U5a-01) per stage: in the case, rejected as a pair, not applicable, site invalid, scored. The scored N is compared with the 80–120 floor, and the overall row carries the ADR-019 item 1 statement (k frozen, actual N, shortfall as a Ch7 deviation, no other lever) and, with `--golden-registered`, the catalogue's registered total (85 at k = 2). `seed_coverage.csv` lists every seed and every manifest rejection with its stage and reason.
   - **Precision and F1 intervals (SO4-06).** They follow the item 3 unit rule as amended. The (project, operator) cell is the unit. Precision: the cell bootstrap from 10 cells, below that Wilson on the pooled precision with n = cells (Clopper–Pearson at 0 or 1); the project cluster bootstrap, descriptive below 10 projects; and Wilson on the TP + FP violations only as the "if independent" bound. F1 is not a binomial proportion: the cell bootstrap from 10 cells and the descriptive project bootstrap, never Wilson. Below n = 10, counts only. The basis is the labelled mode when the score is labelled, else strict. **The unit is the (project, operator) cell, not the project (corrected 2026-10-09 in the SO4 follow-up; the earlier sentence confused projects with cells). A row with 10 or more cells gets the cell bootstrap as the primary interval for both precision and F1; this is expected for the overall held-out row, about 40 cells at k = 2 (85 held-out instances, frozen catalogue), and for most dimension and tag rows. A row with fewer than 10 cells (the per-project rows, and some per-function rows) gets Wilson on the cells for precision (Clopper–Pearson at 0 or 1) and no primary F1 interval. With 7 held-out projects the project cluster bootstrap stays descriptive in every row.** Precision counts the cells with TP + FP > 0 and F1 the cells with TP + FP + FN > 0, and both need n ≥ 10 before any interval is written. Per-project rows rebuild the labelled basis from the instances' item labels, so they share the basis of the other rows. This needs the analysis-plan §5 text in P-U6.
   - **Style (SO1-C).** The style stratum is the spec's `architecture.style` (the style the instrument evaluates with): `[split, style-<s>, all]`. The corpus style (`corpus/corpus.json`) is a column of `denominators.csv`, `prf_by_project.csv`, `seed_coverage.csv` and `golden_instances.csv`, so the style mismatches (zhuravlevma__nestjs-active-record: corpus `layered`, spec `nestjs`) are reported, not hidden. The analysis-plan §3 SO1 "per-style P/R/F1 rows" are these strata rows. P-U6 registers that text.
   - **Zero judge units (report schema).** With no judge unit, no model-judged dimension executes, so `ahsNeuronal` has no executed weight and is absent, and `droppedDimensions` lists `semantic` and `integrity` (`no-judge-units`). The frozen schema required `ahsNeuronal` in every full-mode report, so a valid evaluation failed validation (MarvinRF, `Docs/corpus.md`). **Decision:** a reviewed U3 patch to `schemas/report.schema.json` and its embedded copy. Full mode requires `ahsNeuronal` unless `droppedDimensions` lists both model-judged dimensions. `ahsCombined` and `neuralResults` stay required, and neuronal-only mode is unchanged. No report produced so far changes, and the golden snapshots are unchanged. **MarvinRF is not re-admitted.** Item 5 holds: it stays excluded from SO4, and it may appear only as an exploratory extra after a dated registered decision.

10. **P-U6 registration (2026-10-09; prereg v4).** The bump of item 4 registers every U6 change after P-1 (v2) and P-M (v3). Decisions taken in it:
   - **Item 8 implemented before the bump.** `corpus/label-plan-config.json` version 2: P3 `maxItems` 0 and P2 30 drawn PPS by stratum size; `quota.maxWeeks` 4 and the escalation rule (no refusal; past 720 calls P1 + MS are thinned by a seeded SRS and reported); `exhaustivePlannedBasis` (the FR-24 freeze-gate fixture count: 0 FP-strict per fixture instance); context ceilings per kind (violation and missed seed 6 000, judge unit 32 000 = `codeSnippet` 8 000 × 4); `seeds.audit` = **6105** (6104 is already the registered open-coding shuffle seed of analysis plan §6). `llm-label` counts agy invocations (the cassette entry's `attempts`) and sends no call unless two invocations fit; κ and AC1 get `kappa_ci_*` and `ac1_ci_*`, and the run-vs-run row carries `taxonomy_rule`; the audit is drawn from the plan by kind × population (`AUDIT_SEED_MISMATCH`, `AUDIT_NOT_LABEL_BLIND`). `aggregate` writes label-dependent `fpat_*` as N/A without P3 labels and adds symbolic FPAT rows (`so5_patterns.csv` `basis`).
   - **Aggregate `latency.csv` (item 8, SO2 follow-up).** `within_stage` marks the universal-metric sub-stage, `cycle_query_ms` is renamed `cycle_queries_sum_ms`, `gate_result` is renamed `gate_result_unregistered`, and `total_ms` is `timings.totalMs`. `gate.json` stays the only gate source.
   - **MO-DF01 seeds in `apg-ablation`: not added.** The seeded copies exist only after `mutate`, which runs after P-U6; the six held-out MO-DF01 instances are scored with the full graph in `so4-heldout`, and the ablation's limit is threat TV-96.
   - **Type-resolution rate (X-4): declared dropped.** The APG has no per-reference type-resolution outcome; the import-resolution counts replace it (analysis plan §3; threats register §3).
   - **Item 5.** `so4-heldout` names the seven held-out baseline entries and `e7-corpus` the three E7 bases; the seeded so4-heldout entries follow `mutate` in the item 9 form, with their own dated registration. The count inputs and the spec-chain tools are registered without a recount; the scratch `--bases` lists were not logged, so `u5a-site-feasibility.md` records reconstructed command lines.
   - **Registry.** `REGISTERED_ARTEFACTS` gains the count inputs, the chain tools, `Docs/threats-to-validity.md` (THR-9) and `Docs/labeller-route.md` (SO3). CI runs `--check-prereg` on every `experiments/*/plan.json` for PRs to v1.2e (item 7).

---

## ADR-022: Build and Test sensitivity outcome, ADR-016 b exclusions and post-hoc instrument fixes (v1.2)

**Status**: Accepted (orchestrator, standing approval 2026-10-08; decision 1 (A) given 2026-10-09)

**Date**: 2026-10-09

**Context**: The registered sensitivity plan ran at prereg v5 (P-3). It covered 25 frozen SP-* probes on `fixtures/correct-reference`, and the results are in `results/sensitivity/`. 22 probes fired. Three did not: FF-CV01, FF-CV04 and FF-CV06, the U1 residuals the catalogue predicts. ADR-016 b requires each such check to be fixed if it can be made to fire, and otherwise to be declared excluded (`enabled: false` plus `reason`). ADR-020 item 4 forbids editing the E7 specs after generation. While running these stages, Build and Test also found defects in the scoring and results tooling. Their fixes were made **after** some outputs had been seen, so each one is listed below with the reason it is not outcome-driven.

**Decision**:

1. **FF-CV01 and FF-CV04 are excluded (option A).**
   - **Why.** FF-CV01's per-layer patterns compile to `'.*'`, and no requirement text supplies patterns. Adding patterns would be new spec content. FF-CV04 selects controllers by decorator, and decorators are not ingested (BR-U2-31). A fix needs a requirement outside ADR-015..018.
   - **Where.** `enabled: false` plus `reason` were added, by a scripted insertion, to the three presets, `specs/clean-arch.yaml`, `specs/daedalus-arch.yaml`, the layered fixture spec and the four core corpus specs.
   - **Generated specs.** The six E7 and dev-nest specs were **regenerated by the registered generator** (`scripts/generate-e7-specs.ts`, rule `Docs/e7-spec-rule.md` v1). Only a registered input (the presets) changed. The specs are still pure generator output (`--check` byte-identical), which is consistent with ADR-020 item 4.
   - **Diff evidence.** Each regenerated spec differs from its predecessor (`054f993`) by exactly 4 added lines, the two `enabled`/`reason` pairs. Nothing else changed: layers, globs, styles and header are the same.
   - **Count.** Neither function is targeted by any golden operator (BR-U5a-05; registry test). A verification re-run of the held-out feasibility table on the seven frozen bases gave **k = 2 → 85, k = 3 → 126**, with golden rows identical to `a90f3e3`. This is a check, not a new choice of k.
   - **Golden** (commit `4e94cea`, BT-E1). The five fixture snapshots lose the two vacuous passes (convention `functionCount` 6 → 4). AHS falls by 0.004 on each fixture and every verdict is unchanged.
   - **E1 prompt.** The frozen E1 `full-aac` prompt (generator protocol frozen at B&T Step 41) keeps the preset text of its freeze commit `3049e78`. The generator therefore still reads the two (unfirable) checks as rules. This is declared, not corrected, so that no E1 instrument changes after the pilot.
2. **FF-CV06 fixed within its template text** (`165ec73`). The template required `isBarrel = true` and a declaration. The extractor's barrel definition excludes any file that declares something, so the check could never fire. The template now also reads files named `index.ts` or `index.tsx`, which is within its stated purpose ("barrel/index files that contain business logic declarations"). SP-FF-CV06 fires, and the fixtures have no `index.ts`, so their snapshots do not change. *Post-hoc*: this is the ADR-016 b fix procedure itself, applied after the frozen probe failed.
3. **Post-hoc tooling fixes, none of which changes a measured value:**
   - **(a) No absolute paths in results** (`f3fe474`, `fbef4f1`). `run-experiment` and `build-score-case` relativise absolute repository and sibling paths. The cause was extractor warning text and the manifest `typecheck.tscPath`. The first latency-gate run, which had absolute paths, was discarded and rerun. *Reason*: path text only, NFR-05 portability.
   - **(b) `score-golden --sensitivity`** (`747950c`). `scoreSensitivity` had no caller, so the runbook's `aggregate --sensitivity` input could not be produced. *Reason*: missing plumbing, with no rule change.
   - **(c) Collateral-declared probes** (`6bf460d`). `scoreSensitivity` read only `expected.functionIds`, so SP-FF-S02 (cycle collateral key) and SP-FF-C06 (keyless project-metric) scored `functionId ''`. This was seen on the first scoring. The rule applied is the catalogue §5 text frozen at P-1, not the outcome. Both seeded reports show FF-S02 and FF-C06 going from passed to failed independently of the scorer.
   - **Related, not post-hoc on a result.** The SP forced sites moved from a test into code (`aa8da14`). `so4-plan-entries` pairs a row with the baseline of its own spec (`0fac5b9`) and refuses absolute paths (`0c6a0de`).
4. **Re-run.** The sensitivity plan gains `fixAttempts` for FF-CV01, FF-CV04 and FF-CV06. The probe copies are regenerated under the changed specs, and the plan is rerun into `results/sensitivity/step31/`. The scoring passes `--later-disabled FF-CV01,FF-CV04`, so those two are reported `excludedAfterFail` with their fix-attempt references. The first run (`results/sensitivity/`, P-3) stays as the record of the failed frozen probes. All of this is registered by **P-E (prereg v6)** before the re-run.
5. **Pinned judge CLI** (`5514351`). The author's `claude` install updated itself to `2.1.295`. It is not downgraded, because the author's sessions run on it. Instead, the ADR-018 pin `2.1.294` is installed by exact version under its own prefix (`npm install --prefix ~/.firewall/judge-cli @anthropic-ai/claude-code@2.1.294`, mode 700). The judge uses it by default (`--judge-cli` overrides), and `ClaudeCliProvider` still refuses any other version.
   - **Live check** (2 judge calls, ledger 22 / 200). The binary authenticates through the existing judge config dir (keychain). The init probe passes: tools `[StructuredOutput]`, `mcp_servers` `[]`, `apiKeySource` none, model `claude-opus-5-5`. One judge call returned `is_error` false.
   - **Cassette provenance.** The SEN-01 FF-N01 cassettes (B&T Step 37) were recorded under `2.1.294`, so they and every later cassette share one CLI version.
   - **Config-dir cleanup.** Before the check, the allow-list failed closed on four entries left by a non-judge session at 04:12 (`history.jsonl`, `plugins/`, a session transcript). They were moved, not deleted, to `~/.firewall/judge-config-quarantine-2026-10-09/`, as ADR-018 item 1 prescribes.

**Rationale**: Without the exclusions, two checks that cannot fail would inflate every convention denominator (ADR-016 rationale). Regenerating with the registered generator keeps the E7 specs mechanical. Every after-the-fact change above is either the procedure ADR-016 b prescribes or a tooling defect that changes no measured value, and each is declared here so that Ch7 can cite it.

---

## ADR-023: FLOWS_TO is near-empty on real projects; reported as a limitation

**Status**: Accepted (author, 2026-10-09: "Report as limitation")

**Date**: 2026-10-09

**Context**: The SO2 run reported `edges_flows_to = 0` on every corpus project. A diagnosis found that this is not a defect. The narrow FLOWS_TO definition of U2, scope D8 in `src/apg-extractor/flows-to-deriver.ts`, takes three store patterns: a field initialised with `new T()`, `this.f = new T()`, and `this.f = expr` outside the constructor. Union types and type arguments are skipped, and targets outside the extracted nodes are counted as unextracted. In NestJS and Angular code, collaborators arrive by constructor injection, which the tool records as CONSTRUCTOR_INJECTS edges (309 in ghostfolio). The remaining field stores are primitives, built-in types or outside-scope classes. The measured stores give these edge counts:

| Project | Stores | Edges |
|---|---|---|
| realworld | 2 | 0 |
| ghostfolio `apps/api` | 23 | 0 |
| dry-run | 3 | 0 |
| truthy-demo | 4 | 1, in a spec-excluded test file |

On the fixtures, extraction and ingestion produce exactly the predicted edges (variant-a and variant-c: 1 each). The U2 design (business-logic-model:194, BR-U2-30) and ADR-021 had already predicted this.

**Decision**:
1. The frozen instrument (prereg v7) is unchanged. The definition is not widened.
2. SO2 and Ch7 report data flow as **bounded to field-store patterns, validated on fixtures, and near-empty on DI-style real code**, with the store counts as evidence. They name the ghostfolio constructor-destructuring stores as a concrete recall gap.
3. The missing registered evidence step, `so2-metrics flows-to`, is run so that `results/.../flows_to_stores.csv` records the skip outcomes per project (audit item SO2-4).
4. Ch7 and Ch9 state that SO4 domain purity relies on CONSTRUCTOR_INJECTS together with IMPORTS. It does not rely on FLOWS_TO, which on real code fires only on fixtures and seeded mutants.
5. Widening the definition (constructor-body `this.f = param`, unwrapping `T | null`, `T[]` and `Promise<T>`) is recorded as future work.

**Rationale**: This is the cheapest and most honest option. The diagnosis estimated that a wider definition would add only a handful of edges on these projects, and it would change a frozen instrument.

---

## Decision Log Summary

| **ADR** | **Decision** | **Status** | **Spike Validated** |
| --- | --- | --- | --- |
| 001 | TypeScript-only for v1 | Accepted | ✅ Spike 1 |
| 002 | ts-morph as extraction engine | Accepted | ✅ Spike 1 |
| 003 | Neo4j for APG storage + querying | Accepted | ✅ Spike 2 |
| 004 | AoC YAML with 3-layer structure | Accepted | ✅ Spike 2 |
| 005 | Purpose-built APG schema (5 nodes, 7 edges; amended 2026-10-08 to the v1.2E graph contract: 6 nodes incl. Package, 9 edges incl. RE_EXPORTS, FLOWS_TO, Interface CONTAINS) | Accepted, amended | ✅ Spike 1 + 2 |
| 006 | Fitness functions as parameterized Cypher | Accepted | ✅ Spike 2 |
| 007 | AVR + AHS scoring model | Accepted | ✅ Spike 3 |
| 008 | Seeded violations for ground truth | Accepted | ✅ Spike 3 |
| 009 | CLI-first interface | Accepted | — |
| 010 | Stateless per-project evaluation | Accepted | ✅ Spike 3 |
| 011 | 3×3 factorial experimental design | Superseded by ADR-017 | — |
| 012 | Layer annotation via spec mappings | Accepted | ✅ Spike 1 |
| 013 | Universal health metrics (spec-independent) | Accepted | ✅ Spike 3 |
| 014 | Node.js + TypeScript implementation | Accepted | — |
| 015 | v1.2 lane-2 evaluation-readiness decisions (fix/observe rule, corpus provenance, cycle bound, RE_EXPORTS, tags, merge order) | Accepted | — |
| 016 | v1.2 lane-2 functional-design settlements (NestJS controller binding, cannot-fire checks, 30 s cycle budget, Interface CONTAINS, spec-independent orphan metric) | Accepted | — |
| 014 | Node.js + TypeScript implementation | Accepted | ✅ All spikes |
| 017 | v1.2 scope/requirement amendments for results (corpus core+E7, SO5 in scope, E1 grid, SO4 remap, FR-11/25/27) | Accepted | — |
| 018 | v1.2 U4 judge config-dir allow-list, CLI pin 2.1.294, settings.json content rule | Accepted | — |
| 019 | v1.2 B&T escalations: SO4 floor via E7 then report, base prep rule, E7 specs, Gemini CLI labeller, live-call budget | Accepted | — |
| 020 | v1.2 methodology corrections before runs (baseline precision, label semantics, cell-level recall unit, symbolic-only SO4, SO5 inference, self-preference rows, E7 stratum, reporting duties) | Accepted | — |
| 021 | v1.2 objectives-readiness audit (44 verified gaps) and the U6 integration unit; latency gate moved to U6; P-U6 bump | Accepted | — |
| 022 | v1.2 B&T sensitivity outcome: FF-CV01, FF-CV04 excluded (presets, specs, E7 regenerated by the registered generator), FF-CV06 template fix, post-hoc tooling fixes declared; P-E bump | Accepted | — |
| 023 | FLOWS_TO near-empty on real DI-style code: reported as an SO2 limitation, instrument unchanged | Accepted | — |
