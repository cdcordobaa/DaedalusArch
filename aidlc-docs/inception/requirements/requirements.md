# Requirements Document — Architectural Firewall (DaedalusArch)

## Intent Analysis

- **User Request**: Build the Architectural Firewall — a neuro-symbolic architectural compliance product that any team can plug into their development cycle
- **Request Type**: New Project (greenfield)
- **Scope Estimate**: System-wide — 8 core pipeline modules + neuro-symbolic router, CLI, CI/CD integration (GitHub Action / PR trigger), batch evaluation
- **Complexity Estimate**: Complex — graph database pipeline, Cypher compilation, neuro-symbolic routing (LLM Critic Agent), multi-dimensional scoring, CI/CD integration, BDD/TDD/DDD methodologies
- **Build Scope**: v1.0 product release + selected enhancements (JSON Schema validation, ADR multi-format parsing)
- **Identity**: This is a **product** — a developer tool for any team. Not a prototype.

---

## Product Vision

> **A developer tool that evaluates TypeScript projects for architectural compliance — quantitatively and automatically — plugging into any team's development cycle via CLI or CI/CD. Combines deterministic graph analysis with semantic LLM evaluation via neuro-symbolic routing.**

**Core value proposition**: Quantitative, multi-dimensional, actionable architectural health reports. The symbolic path (Cypher/APG) is fully deterministic. The neural path (LLM Critic) captures what graph queries cannot — semantic violations, intent compliance, soft responsibility analysis.

---

## Functional Requirements

### FR-01: APG Extractor (ts-morph)
- **FR-01.1**: Parse TypeScript projects using ts-morph with lenient mode (handle missing dependencies)
- **FR-01.2**: Extract 5 node types: File, Class, Interface, Method, Function
- **FR-01.3**: Extract 7 edge types: IMPORTS, IMPLEMENTS, EXTENDS, CONSTRUCTOR_INJECTS, CALLS, DECLARES, CONTAINS
- **FR-01.4**: Resolve barrel imports, path aliases, decorator extraction, DI type resolution
- **FR-01.5**: Output APG as structured JSON with nodes[] and edges[]
- **FR-01.6**: Report parse coverage % (files successfully parsed / total files)

### FR-02: Neo4j Ingestion + Layer Annotation
- **FR-02.1**: Ingest APG JSON into Neo4j (create nodes with labels and properties, create relationships)
- **FR-02.2**: Apply layer annotations based on AoC YAML spec mappings (directory, naming, decorator — in priority order)
- **FR-02.3**: Assign `layer` and `role` properties to each node
- **FR-02.4**: Files matching no mapping rule get `layer: null` (excluded from layer-dependent fitness functions)
- **FR-02.5**: **Hybrid Operational Model and State Management**:
  - **Stateless Mode (Default for Benchmark)**: Fresh parsing and fresh graph per project. Guaranteed isolation.
  - **Persistent Mode (Monitoring/Drift)**: Enabled via `--persist` or `--diff`. Uses versioned snapshots and incremental updates.


### FR-03: APG Persistence, Snapshots, and Drift Detection
- **FR-03.1**: The system must NOT regenerate the full APG on every execution. Persist the graph as a versioned snapshot tied to the commit SHA or release tag
- **FR-03.2**: **Delta APG (Operational Efficiency)** — On each PR or subsequent run, compute only the nodes and edges affected by files modified since the last snapshot. The base APG persists between executions and is updated incrementally.
- **FR-03.3**: **Snapshot Storage Model**:
  ```
  APG_Store/
    snapshot_{commit_sha}/        # full graph at that point
      nodes.json
      edges.json
      metadata.json               # timestamp, author, AVR at that commit
    delta_{sha_old}_{sha_new}/    # diff between two snapshots
      added_nodes[]
      removed_nodes[]
      added_edges[]
      removed_edges[]
    drift_report_{sha_new}.json   # computed drift metrics
  ```
- **FR-03.4**: **Architectural Drift Detection** — By maintaining historical APG snapshots per commit, detect accumulated architectural degradation across time:
  | Drift Type | What is measured | Alert signal |
  |---|---|---|
  | Structural drift | New dependencies between previously decoupled modules | New IMPORTS edges between layers that had none |
  | Coupling drift | Sustained increase in average graph fan-out | Average fan-out grows > 15% between consecutive releases |
  | Convention drift | Gradual erosion of naming/layer conventions | % of nodes meeting conventions decreases between snapshots |
  | Violation trend | Cumulative AVR across commit history | AVR increases steadily — accumulating technical debt signal |
- **FR-03.5**: **Incremental Extraction & Ingestion**:
  - Use file hashing (MD5/mtime) to identify modified files.
  - In Persistent Mode, the extractor (ts-morph) only parses modified files.
  - The ingestor detaches/deletes old nodes for modified files before merging new nodes.

- **FR-03.5**: Generate drift reports comparing any two snapshots, with metrics and delta visualization
- **FR-03.6**: Drift detection integrates with CI/CD — alert when drift metrics exceed configurable thresholds

### FR-04: AoC YAML Spec Parser
- **FR-04.1**: Parse 3-layer AoC YAML: Layer A (model), Layer B (fitness functions), Layer C (scoring)
- **FR-04.2**: Support `style: clean-architecture` with auto-loaded template of 17 symbolic + N semantic fitness functions
- **FR-04.3**: Validate AoC YAML against JSON Schema at parse time; produce clear error messages with line numbers
- **FR-04.4**: Support layer definitions with directories, naming conventions, and decorator mappings
- **FR-04.5**: Support fitness function declarations with dimension, severity, threshold, and **route** (symbolic / neuronal / hybrid)
- **FR-04.6**: For neuronal/hybrid fitness functions, require and validate `semantic_criteria` block containing:
  - `rule` (required): architectural rule in natural language, distilled from the ADR
  - `adr_ref` (optional): path to original ADR file for additional context at evaluation time
  - `rubric` (required): structured pass/fail criteria with `pass`, `fail`, and `evidence_required` fields
- **FR-04.7**: Layer C must support separate confidence thresholds for neuronal assessments

### FR-05: ADR Parsing and Ingestion
- **FR-05.1**: Parse architectural decision records in multiple formats: MADR, Nygard, Y-Statements, custom YAML-based ADRs
- **FR-05.2**: For each ADR, produce two types of rules:
  - Graph-queryable rules compiled to parameterized Cypher queries (symbolic path)
  - Semantic criteria as natural language rule + rubric for LLM Critic evaluation (neuronal path)
- **FR-05.3**: v1: architect manually writes AoC YAML and embeds semantic criteria derived from ADRs. The system supports loading ADR prose at evaluation time via `adr_ref`
- **FR-05.4**: If `adr_ref` is provided in a fitness function, validate that the referenced file exists at evaluation time (warning, not error — allows spec portability)

### FR-06: Violation Taxonomy
- **FR-06.1**: Maintain a consolidated violation taxonomy (informed by OX Security, Slater, Sobania, GIST Study)
- **FR-06.2**: Each violation type maps to: detecting fitness function(s), route (symbolic/neuronal/hybrid), severity (critical/major/minor/advisory)
- **FR-06.3**: The taxonomy is extensible — users can add custom violation types via the AoC YAML spec

### FR-07: Fitness Function Compiler
- **FR-07.1**: Compile each symbolic fitness function to a parameterized Cypher query template
- **FR-07.2**: Instantiate templates with values from AoC YAML spec
- **FR-07.3**: Support 17+ fitness functions across 7 dimensions:
  - **Structural (3)**: dependency-direction, no-circular-dependencies, database-bypass — *symbolic only*
  - **Coupling (3)**: domain-stability, module-fan-out, component-instability — *symbolic only*
  - **Pattern (3)**: domain-purity, dependency-inversion, repository-pattern — *symbolic only*
  - **SOLID (4)**: use-case-isolation, SRP-proxy, ISP-proxy, inheritance-depth — *hybrid* (symbolic first, then neuronal if symbolic passes)
  - **Convention (4)**: naming-conventions, test-coverage-proxy, error-handling, orphan-detection — *symbolic only*
  - **Semantic (new)**: abstraction-quality, naming-coherence-with-domain — *neuronal only*
  - **Intent (new)**: ADR-prose-compliance, framework-agnosticism — *neuronal only*
- **FR-07.4**: Output array of executable Cypher queries with metadata (dimension, severity, thresholds, route)
- **FR-07.5**: Tag each fitness function with its route type for the neuro-symbolic router

### FR-08: Neuro-Symbolic Router
- **FR-08.1**: Route each fitness function to the appropriate evaluation path based on its route tag:
  - **Symbolic route**: Cypher query execution against APG (deterministic)
  - **Neuronal route**: LLM Critic Agent evaluation (semantic analysis)
  - **Hybrid route**: Symbolic first; if pass (no hard violation), then neuronal evaluation
- **FR-08.2**: Activation rules (static, auditable — no case-by-case evaluation):
  - `structural`, `coupling`, `pattern`, `convention` → **symbolic only** (neuronal never activates)
  - `semantic`, `intent` → **neuronal always** (LLM Critic required)
  - `solid` → **hybrid** (symbolic hard-check first, neuronal soft-check if symbolic passes)
- **FR-08.3**: The router is deterministic — same fitness function always takes the same route
- **FR-08.4**: Neuronal route results are tagged as `deterministic: false` in the output
- **FR-08.5**: Support `--symbolic-only` mode (skip all neuronal evaluations for fully deterministic results)

### FR-09: Evaluation Engine (Symbolic Path)
- **FR-09.1**: Execute compiled Cypher queries against Neo4j graph
- **FR-09.2**: Collect per-function results with violation details (violator file path, source layer, target layer)
- **FR-09.3**: Compute pass/fail per fitness function based on thresholds
- **FR-09.4**: Support APOC plugin for cycle detection (`apoc.path.expandConfig`)

### FR-10: LLM Critic Agent (Neuronal Path)
- **FR-10.1**: For each neuronal/hybrid fitness function, assemble a context packet:
  - Code snippet (the file or class being evaluated from project source) — always
  - APG subgraph (the node and its immediate neighborhood from Neo4j) — always
  - `semantic_criteria.rule` from AoC YAML Layer B — always
  - `semantic_criteria.rubric` from AoC YAML Layer B — always
  - Full ADR prose loaded from `adr_ref` file path — only if provided
- **FR-10.2**: Evaluate semantic violations that graph queries cannot express:
  - Abstraction quality: does an interface make semantic sense, not just syntactic?
  - Naming coherence: do class/method names align with the domain model?
  - ADR prose compliance: does the code respect the spirit of architectural decisions?
  - Soft SRP: does a class with few methods still mix unrelated responsibilities?
- **FR-10.3**: Return structured verdict: `{ pass/fail/warning, confidence: 0.0-1.0, reasoning: string, evidence: string[], violations: Violation[] }`
- **FR-10.4**: Configurable LLM provider (support Claude, GPT-4o, or other providers via adapter)
- **FR-10.5**: Temperature=0 and fixed seed (when API supports it) for maximum consistency
- **FR-10.6**: Execute 3-5 runs per evaluation and report mean +/- standard deviation
- **FR-10.7**: Compute ICC (Intraclass Correlation Coefficient) across runs — target ICC > 0.70; flag unstable functions and downweight in combined score
- **FR-10.8**: Rubric-based evaluation with calibrated scoring criteria to minimize variance
- **FR-10.9**: Every LLM Critic call logged with input context, prompt, and response for auditability

### FR-11: Verdict Merge Logic
- **FR-11.1**: Merge results from symbolic and neuronal paths into a unified verdict:
  - **Hard block**: Any critical symbolic violation OR neuronal violation with confidence >= high threshold → PR cannot merge
  - **Soft block**: Major symbolic violation OR neuronal violation with confidence in warning zone → PR requires reviewer override
  - **Warning**: Minor violations or neuronal assessment with low confidence → informational only
  - **Pass**: No violations from either path → PR can merge
- **FR-11.2**: Confidence calibration thresholds (tunable):
  - High confidence (>= 0.85): verdict counts as hard evidence
  - Medium confidence (0.60-0.85): verdict counts as warning
  - Low confidence (< 0.60): informational only, excluded from AHS

### FR-12: Scoring Engine
- **FR-12.1**: Compute AVR (Architectural Violation Ratio) per dimension: violated functions / total functions in dimension
- **FR-12.2**: Compute AHS (Architectural Health Score): weighted complement — AHS = Sum(wi * (1 - AVRi))
- **FR-12.3**: Apply Layer C scoring weights across 7 dimensions.
  - **Standard v1 Defaults (ADR-007)**: Structural 0.25, Coupling 0.15, Pattern 0.25, SOLID 0.20, Convention 0.15.
  - **Neuro-Simbólico v1.1 Extensions**: Semantic 0.15, Intent 0.10 (redistributed from standard weights when enabled).

- **FR-12.4**: **Universal Health Metrics (Spec-Independent)**: List of metrics grounded in software engineering literature (Martin's stability, etc.) that run regardless of the spec:
  - **Circular Dependencies**: Cycle count in the IMPORTS graph.
  - **Fan-out / Fan-in**: Max and average outgoing/incoming IMPORTS per file.
  - **Abstraction Ratio**: Ratio of interfaces to total (interfaces + classes).
  - **Instability Index**: Ratio of fan-out to total coupling (fan-out / (fan-in + fan-out)).
  - **Orphan Files**: Nodes with no IMPORTS or IMPORTED_BY edges.

- **FR-12.5**: Produce dual scores:
  - `ahs_deterministic` — symbolic path only (fully reproducible)
  - `ahs_combined` — symbolic + neuronal (may vary across runs)
- **FR-12.6**: Tag each result with its evaluation route (symbolic/neuronal/hybrid) and determinism flag
- **FR-12.7**: Support `--symbolic-only` scoring mode that excludes neuronal dimensions from AHS

### FR-13: Structured Violation Report
- **FR-13.1**: Output JSON report with: project name, commit SHA, ahs_deterministic, ahs_combined, verdict, per-dimension breakdown (AVR, path, confidence for neuronal), violations array, universal metrics
- **FR-13.2**: Human-readable summary format for CLI and PR comments
- **FR-13.3**: CSV output for batch evaluation (one row per project)

### FR-14: CLI Interface
- **FR-14.1**: `firewall evaluate --project <path> --spec <yaml>` — Single project evaluation.
- **FR-14.2**: `firewall batch --dir <path> --spec <yaml> --output <csv>` — Batch evaluation of multiple projects.
- **FR-14.3**: **Supported Flags**:
  - `--format json|human|csv`: Output format.
  - `--verbose`: Includes per-function violation details and routing logs.
  - `--neo4j-uri <uri>` (Default: `bolt://localhost:7687`): Custom Neo4j connection.
  - `--symbolic-only`: Skips all neuronal path evaluations for 100% determinism.
  - `--persist`: Enables JSON snapshot storage and incremental ingestion.
  - `--diff <sha>`: Compares current state against a historical snapshot.
- **FR-14.4**: JSON output to stdout, human-readable summary to stderr.
- **FR-14.5**: Use Commander.js as CLI framework.
- **FR-14.6**: Exit codes: 0 = pass, 1 = violations found (soft/hard block), 2 = evaluation error.


### FR-15: CI/CD Integration
- **FR-15.1**: GitHub Action that runs on `pull_request` events (opened, synchronize, reopened)
- **FR-15.2**: Evaluate the PR's target branch codebase against the repo's `.firewall.yaml` spec
- **FR-15.3**: Post evaluation results as a PR comment with:
  - AHS score (deterministic and combined shown separately)
  - Per-dimension breakdown (all 7 dimensions with route tags)
  - List of violations with file paths, descriptions, and route
  - Verdict (hard block / soft block / warning / pass)
- **FR-15.4**: Set GitHub check status based on verdict and configurable AHS threshold (default: 0.70)
- **FR-15.5**: Support manual trigger via workflow dispatch or `/firewall` PR comment command
- **FR-15.6**: Neo4j service container provisioned within the GitHub Action workflow
- **FR-15.7**: Configurable: run symbolic-only in CI (fast, deterministic) or full neuro-symbolic (comprehensive)

### FR-16: Batch Runner
- **FR-16.1**: Evaluate N projects sequentially against a spec
- **FR-16.2**: Produce CSV with one row per project (AVR overall, AVR per-dimension, ahs_deterministic, ahs_combined, universal metrics, route tags)
- **FR-16.3**: Skip failed projects and continue (report failures in output)
- **FR-16.4**: Performance: < 5 seconds per project symbolic-only; neuronal adds LLM latency per call

### FR-17: Sample Projects + Validation Set
- **FR-17.1**: Create 5-10 TypeScript projects demonstrating various architectural compliance levels
- **FR-17.2**: Include 2-3 clean reference projects (zero violations, AHS >= 0.90)
- **FR-17.3**: Include projects with known violations across all 7 dimensions (including semantic and intent — violations detectable only by the neuronal path)
- **FR-17.4**: Each project includes a MANIFEST.md listing: violation type, file path, expected detecting fitness function, dimension, expected route, expected severity
- **FR-17.5**: Serve as both validation set and usage examples for new adopters

---

## Non-Functional Requirements

### NFR-01: Determinism (Dual-Path Model)
- **Symbolic path**: Same code + same spec = same score. Always. Without exception. Fully deterministic.
- **Neuronal path**: LLM Critic operates at temperature=0 with fixed seed and rubric-based evaluation. Acknowledged as not fully deterministic — results tagged `deterministic: false`. Reproducibility target: ICC > 0.70.
- **Governance mode**: `--symbolic-only` flag guarantees full determinism for teams that require it for governance/blocking decisions
- **Transparency**: Every evaluation result clearly indicates which path produced it and reports `ahs_deterministic` separately from `ahs_combined`

### NFR-02: Performance
- Full APG construction: < 5 seconds per project (spike-validated)
- Delta APG update: < 2 seconds for typical PR-sized changes
- Symbolic-only evaluation: < 5 seconds per project
- Full neuro-symbolic pipeline (symbolic + neuronal): < 30 seconds per project
- CI/CD feedback: evaluation completes within typical CI job timeframes

### NFR-03: Detection Accuracy
- Precision >= 90% against validation set manifests (overall: symbolic + neuronal)
- Recall >= 85% against validation set manifests (overall: symbolic + neuronal)
- Cohen's kappa >= 0.60 (LLM Critic vs. human judgment, neuronal path only)
- ICC >= 0.70 (LLM Critic across runs, neuronal path reproducibility)
- Monotonic AHS discrimination: clean projects score higher than violated ones

### NFR-04: Resilience
- Handle partially broken TypeScript (missing deps, unresolvable imports) via lenient parsing
- Report parse coverage % per project
- Skip unresolvable files, don't crash
- Graceful degradation: partial results are better than no results

### NFR-05: Reproducibility
- Docker Compose for Neo4j (identical environment for any user)
- Lock file committed (exact dependency versions)
- Deterministic pipeline by design (symbolic path)
- GitHub Action uses pinned versions (no `latest` tags)
- Fixed LLM API versions, temperatures, and seeds for neuronal path
- Published prompts for all LLM Critic evaluations

### NFR-06: Developer Experience
- `npm install -g @daedalus/firewall` installs globally and just works
- Clear, actionable error messages (not stack traces)
- Human-readable output by default, JSON for tooling
- PR comments are scannable — highlight what's wrong, not just a score dump
- Getting started: < 5 minutes from install to first evaluation

---

## Development Methodology Requirements

### METH-01: Behavior-Driven Development (BDD)
- All modules must have Gherkin feature files (`.feature`) describing behavior in Given/When/Then
- Use `@cucumber/cucumber` with `jest-cucumber` for test execution
- Feature files serve as living documentation and acceptance criteria
- Feature files written BEFORE implementation (outside-in)

### METH-02: Test-Driven Development (TDD)
- Red-Green-Refactor cycle for all production code
- Unit tests written BEFORE implementation code
- Minimum 80% code coverage target
- Jest as the test runner
- Integration tests for Neo4j interactions and LLM Critic calls (mocked provider)

### METH-03: Domain-Driven Design (DDD)
- **Ubiquitous Language**: Use product terminology consistently (APG, AoC, AVR, AHS, fitness function, dimension, layer, role, violation, symbolic, neuronal, hybrid, verdict)
- **Bounded Contexts**: Each pipeline module is a bounded context with clear interfaces
  - APG Extractor context: ts-morph parsing, AST traversal, node/edge extraction
  - Neo4j Ingestion context: graph database operations, layer annotation, delta APG, drift detection
  - Spec Parser context: AoC YAML parsing, ADR parsing, schema validation, template resolution
  - Fitness Compiler context: Cypher query generation, template instantiation
  - Neuro-Symbolic Router context: route dispatch, activation rules, mode selection
  - Evaluation Engine context (symbolic): Cypher query execution, result collection
  - LLM Critic Agent context (neuronal): context assembly, prompt construction, rubric evaluation, structured verdicts
  - Scoring Engine context: AVR/AHS computation, dual scoring, verdict merge, universal metrics
- **Domain Model**: Rich domain objects for APG nodes, edges, fitness functions, violations, scores, verdicts
- **Anti-Corruption Layers**: Adapters between modules (e.g., APG JSON format between Extractor and Ingestion)
- **Value Objects**: Immutable types for scores (AVR, AHS), dimensions, severity levels, confidence, verdicts
- **Repository Pattern**: For Neo4j graph operations (GraphRepository interface)

---

## Technical Decisions (from ADR)

| Decision | Choice | ADR |
|---|---|---|
| Target Language | TypeScript only (v1) | ADR-001 |
| Extraction Engine | ts-morph v22+ | ADR-002 |
| Graph Database | Neo4j Community Edition | ADR-003 |
| Spec Format | AoC YAML (3-layer) | ADR-004 |
| Graph Schema | APG (5 nodes, 7 edges) | ADR-005 |
| Query Approach | Parameterized Cypher templates | ADR-006 |
| Scoring Model | AVR + AHS (dual: deterministic + combined) | ADR-007 |
| Validation Strategy | Known-violation projects with manifests | ADR-008 |
| Interface | CLI-first (Commander.js) + GitHub Action | ADR-009 |
| State Model | Stateless per-project + versioned snapshots for drift | ADR-010 |
| Annotation | Spec mapping (deterministic) | ADR-012 |
| Universal Metrics | Spec-independent health metrics | ADR-013 |
| Implementation | Node.js + TypeScript | ADR-014 |

---

## Project Structure

```
src/
  apg-extractor/         # Module 1: ts-morph --> APG JSON
  neo4j-ingestion/       # Module 2: APG JSON --> Neo4j + layer annotation + delta APG
  spec-parser/           # Module 3: AoC YAML + ADR parsing + validation
  fitness-compiler/      # Module 4: Fitness function --> Cypher compilation
  neuro-symbolic-router/ # Module 5: Route dispatch (symbolic/neuronal/hybrid)
  evaluation-engine/     # Module 6: Symbolic path — Cypher execution + result collection
  llm-critic/            # Module 7: Neuronal path — LLM Critic Agent + context assembly
  scoring-engine/        # Module 8: AVR/AHS computation + verdict merge + universal metrics
  cli/                   # CLI entry points (evaluate, batch)
  shared/                # Shared domain types, value objects, interfaces, violation taxonomy
tests/
  features/              # BDD Gherkin feature files
  unit/                  # TDD unit tests (mirrors src/ structure)
  integration/           # Integration tests (Neo4j, LLM Critic, end-to-end pipeline)
fixtures/                # Sample/validation TypeScript projects with MANIFESTs
specs/                   # Sample AoC YAML specs (clean-architecture template)
.github/
  actions/
    firewall/            # GitHub Action definition (action.yml)
  workflows/
    ci.yml               # CI pipeline for the Firewall project itself
docker-compose.yml       # Neo4j setup for local development
```

---

## Security Requirements (Bare Minimum)

| Rule | Description | Applicability |
|---|---|---|
| SECURITY-05 | Input Validation — validate AoC YAML input, ADR files, project paths, CLI args | CLI inputs, YAML/ADR parsing |
| SECURITY-10 | Supply Chain — lock file, pinned deps, no unused packages | Package management |
| SECURITY-12 | Secret Management — no hardcoded Neo4j/LLM API credentials, use env vars | Neo4j connection config, LLM API keys |
| SECURITY-15 | Safe Error Handling — fail closed, resource cleanup, global error handler | All modules, CLI |

All other SECURITY rules: **N/A** (CLI tool + GitHub Action — no user auth, no web server, no cloud infra)

---

## Extension Configuration

| Extension | Enabled | Decided At |
|---|---|---|
| Security Baseline | Partial (SECURITY-05, 10, 12, 15 only) | Requirements Analysis |

---

## Out of Scope (Separate Efforts)

- **Empirical validation / benchmarking**: Ablation study (symbolic-only vs neuronal-only vs combined), comparative benchmark (3x3 factorial), human evaluator protocol, ANOVA — separate research effort
- **ISE (Implicit Specification Extraction)**: Auto-infer spec from existing codebase — future product feature
- **Automated ADR-to-YAML translation**: LLM-assisted ADR parser — future product feature (v1 is manual)
- **Web dashboard**: AHS trend tracking, drift visualization, per-repo history — future product feature
- **Multi-language support**: Python, Java extractors — future product feature
- **Diff-scoped evaluation**: Only analyze changed files in a PR (delta APG partially addresses this) — future optimization
- **LLM code generation**: The Firewall evaluates, it does not generate or fix code

---

## Tracing to Specific Objectives (SO)

| SO | Functional Requirements | Spike Status |
|---|---|---|
| **SO1: Spec Ingestion** | FR-04, FR-05, FR-07 | Partially Validated (YAML works, ADR pending) |
| **SO2: APG Construction** | FR-01, FR-02, FR-03 | ✅ Core Validated (Spike 1) |
| **SO3: Review Gate** | FR-08, FR-09, FR-10, FR-11 | ✅ Symbolic Validated (Spike 2) |
| **SO4: Empirical Validation** | FR-16, FR-17 | ✅ Strategy Validated (Spike 3) |

---

## Reference Documents


- **PRD**: `Docs/PRD — Architectural Firewall Spec-Driven Compliance.md`
- **ADR**: `Docs/ADR — Architectural Decision Records Firewall Tech.md`
- **Product Vision**: `Docs/Product Vision - Architectural Firewall`
- **Ad-Hoc System Requirements**: `Docs/AdHoc System Requirements — Architectural Firewall.md` (SO1-SO4 traceability, neuro-symbolic routing criteria, semantic_criteria schema, LLM Critic context assembly, violation taxonomy, delta APG/drift detection)

---

## Acceptance Criteria

1. `firewall evaluate --project ./clean-ref --spec ./clean-arch.yaml` produces AHS >= 0.90
2. `firewall evaluate --project ./violated-project --spec ./clean-arch.yaml` detects known violations listed in MANIFEST.md
3. `firewall batch --dir ./fixtures --spec ./clean-arch.yaml --output results.csv` completes without error
4. All 17 symbolic fitness functions compile to valid Cypher and execute successfully
5. AVR/AHS scoring produces monotonic discrimination (clean > semi-violated > fully-violated)
6. Symbolic-only evaluation completes in < 5 seconds per project
7. Full neuro-symbolic evaluation completes in < 30 seconds per project
8. GitHub Action runs on PR, posts comment with dual AHS + violations + verdict, sets check status
9. BDD feature files pass for all modules
10. Unit test coverage >= 80%
11. `npm install -g` and `firewall evaluate` works end-to-end with Docker Compose Neo4j
12. `--symbolic-only` flag produces fully deterministic, reproducible results
13. Neuronal path (LLM Critic) detects semantic violations that symbolic path cannot (e.g., soft SRP on a 4-method class mixing auth + billing)
14. Neuro-symbolic router correctly dispatches: structural/coupling/pattern/convention --> symbolic, semantic/intent --> neuronal, SOLID --> hybrid
15. Every evaluation result tagged with route (symbolic/neuronal/hybrid), determinism flag, and confidence (for neuronal)
16. `semantic_criteria` blocks validated at spec parse time; malformed specs produce clear error messages
17. LLM Critic ICC >= 0.70 across 3-5 runs per evaluation
