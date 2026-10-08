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
| 011 | 3×3 factorial experimental design | Superseded by ADR-017 | — |
| 012 | Layer annotation via spec mappings | Accepted | ✅ Spike 1 |
| 013 | Universal health metrics (spec-independent) | Accepted | ✅ Spike 3 |
| 014 | Node.js + TypeScript implementation | Accepted | — |
| 015 | v1.2 lane-2 evaluation-readiness decisions (fix/observe rule, corpus provenance, cycle bound, RE_EXPORTS, tags, merge order) | Accepted | — |
| 016 | v1.2 lane-2 functional-design settlements (NestJS controller binding, cannot-fire checks, 30 s cycle budget, Interface CONTAINS, spec-independent orphan metric) | Accepted | — |
| 014 | Node.js + TypeScript implementation | Accepted | ✅ All spikes |
| 017 | v1.2 scope/requirement amendments for results (corpus core+E7, SO5 in scope, E1 grid, SO4 remap, FR-11/25/27) | Accepted | — |
| 018 | v1.2 U4 judge config-dir allow-list, CLI pin 2.1.294, settings.json content rule | Accepted | — |
