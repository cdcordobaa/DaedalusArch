# Units of Work — Architectural Firewall (DaedalusArch)

## Decomposition Strategy

- **Grouping**: Logical groupings (~6-7 functional units + infrastructure + validation)
- **Build Order**: Bottom-up (shared domain first, then foundation, then dependents)
- **Infrastructure**: First (Unit 0 — project scaffolding before any functional code)
- **Validation Set**: First functional unit (golden test data — true system-level TDD)

---

## Unit 0: Infrastructure Scaffolding

**Components**: Project setup (no application components)

**Scope**:
- Fresh `package.json` (replace "symphony" config — Q2: A from requirements)
- `tsconfig.json` with strict mode, ESNext target, NodeNext module
- `jest.config.cjs` configured for TypeScript + jest-cucumber
- `docker-compose.yml` with Neo4j Community Edition + APOC plugin
- `.env.example` with Neo4j and LLM API key placeholders
- Directory structure: `src/` (all 11 module dirs), `tests/` (features/, unit/, integration/), `fixtures/`, `specs/`, `.github/`
- ESLint + Prettier configuration
- `npm install` with all production + dev dependencies locked

**Deliverables**:
- Working project scaffolding
- `docker-compose up -d` starts Neo4j
- `npm test` runs (empty test suite passes)
- All module directories created with index.ts stubs

**Stories**: None (infrastructure — no user stories)

---

## Unit 1: Shared Domain + Validation Set

**Components**: C10 (Shared Domain), C11 (FirewallContext), FR-17 (Sample Projects)

**Scope**:
- **C10**: All domain types, value objects, interfaces
  - APGNode, APGEdge, FitnessFunction, Violation, Dimension, Severity, Route
  - Value objects: AVRScore, AHSScore, Confidence, Verdict, CommitSha
  - Interfaces: GraphRepository, LLMProvider, SnapshotStore, PipelineStage, PipelineCommand
  - DomainResult<T> universal result model
  - Result<T, E> error propagation type
  - PipelineError base types (critical vs warning)
  - Violation taxonomy (extensible)
  - EvaluationMode type: full | symbolic-only | neuronal-only
- **C11**: FirewallContext aggregate root
  - ApgNodeMap, AppliedAoCSpec, EvaluationVerdicts, PipelineAuditLog
- **FR-17**: 5-10 sample TypeScript projects as golden test data
  - 2-3 clean reference projects (zero violations, AHS >= 0.90)
  - Projects with seeded violations across all 7 dimensions
  - MANIFEST.md per project listing expected violations
  - Sample AoC YAML spec (`specs/clean-arch.yaml`) with clean-architecture template

**Deliverables**:
- All shared types importable by other modules
- FirewallContext wired with value objects
- Validation set in `fixtures/` with manifests
- Sample spec in `specs/`
- Full BDD feature files + TDD unit tests for domain types

**Stories**: US-6.1, US-6.2, US-17.1, US-17.2, US-17.3, US-17.4

---

## Unit 2: APG Extractor

**Components**: C1 (APG Extractor)

**Scope**:
- ts-morph project parsing with lenient mode
- 5 node type extraction (File, Class, Interface, Method, Function)
- 7 edge type extraction (IMPORTS, IMPLEMENTS, EXTENDS, CONSTRUCTOR_INJECTS, CALLS, DECLARES, CONTAINS)
- Barrel import resolution, path alias resolution, decorator extraction, DI type resolution
- APG JSON output (nodes[], edges[])
- Parse coverage reporting
- Validate output against golden test data from Unit 1 fixtures

**Deliverables**:
- `extractAPG()` function producing APGResult
- BDD features: extraction of nodes, edges, complex imports, parse coverage
- TDD unit tests for each extraction function
- Integration test: extract APG from Unit 1 fixture projects

**Stories**: US-1.1, US-1.2, US-1.3, US-1.4, US-1.5, US-1.6

---

## Unit 3: Spec Parser + Fitness Compiler

**Components**: C3 (Spec Parser), C4 (Fitness Compiler)

**Scope**:
- **C3**: AoC YAML 3-layer parsing (Layer A, B, C)
  - Template resolution (`style: clean-architecture`)
  - JSON Schema validation with line-number errors
  - Layer definitions (directories, naming, decorators)
  - Fitness function parsing with route tags
  - semantic_criteria block validation (rule, rubric, adr_ref)
  - Neuronal confidence thresholds from Layer C
  - ADR parsing (MADR, Nygard, Y-Statements, custom YAML)
  - Dual rule production (symbolic Cypher + semantic criteria)
  - Spec schema versioning handshake
- **C4**: Fitness function compilation
  - Symbolic -> parameterized Cypher query templates
  - Neuronal -> context assembly instructions
  - Hybrid -> CypherQuery + NeuronalInstruction pairs
  - Route tagging for router dispatch
  - Validate compiled output against sample spec from Unit 1

**Deliverables**:
- `parseSpec()` producing ParsedSpec
- `compileFunctions()` producing CompiledFunctions
- BDD features: spec parsing, schema validation, template resolution, ADR parsing, Cypher compilation
- TDD unit tests for each parser and compiler function
- Integration test: parse sample spec, compile, verify Cypher validity

**Stories**: US-4.1-US-4.7, US-5.1-US-5.4, US-7.1, US-7.2

---

## Unit 4: Neo4j Ingestion + Persistence

**Components**: C2 (Neo4j Ingestion), S2 (GraphRepositoryService), S3 (SnapshotService)

**Scope**:
- **S2**: Neo4j connection pool, GraphRepository implementation
  - Session checkout/release, query execution, health check, graceful shutdown
- **C2**: APG ingestion into Neo4j
  - Node creation with labels and properties
  - Edge creation as relationships
  - Layer annotation (directory > naming > decorator priority)
  - Stateless mode: clear graph before ingestion
  - Delta APG computation (incremental update)
- **S3**: Snapshot persistence
  - Save/load snapshots (Neo4j + filesystem)
  - Delta storage (added/removed nodes/edges)
  - Drift detection (structural, coupling, convention, violation trend)
  - Drift report generation
  - APG_Store directory management
- Validate: ingest APG from Unit 2 output into Neo4j, verify graph queries work

**Deliverables**:
- GraphRepositoryService with connection pool
- `ingestAPG()` producing IngestionResult
- SnapshotService with full drift detection
- BDD features: ingestion, layer annotation, delta APG, drift detection
- TDD unit tests (mocked Neo4j for unit, real Neo4j for integration)
- Integration test: extract fixture -> ingest -> query graph -> verify layer annotations

**Stories**: US-2.1-US-2.4, US-3.1-US-3.8

---

## Unit 5: Neuro-Symbolic Router + Evaluation Paths

**Components**: C5 (Router), C6 (Evaluation Engine), C7 (LLM Critic Agent), S4 (LLMProviderService), S5 (AuditLogService)

**Scope**:
- **C5**: Route dispatch based on route tags
  - Static activation rules (symbolic/neuronal/hybrid dispatch)
  - Three modes: full, symbolic-only, neuronal-only
  - Determinism tagging
  - Concurrency coordination (symbolic || neuronal parallel dispatch)
- **C6**: Symbolic evaluation engine
  - Cypher query execution against Neo4j
  - Violation collection (file path, source/target layer)
  - Pass/fail per function based on thresholds
  - APOC cycle detection
- **C7**: LLM Critic Agent
  - Context packet assembly (code + subgraph + rule + rubric + ADR prose)
  - Prompt construction from semantic_criteria
  - LLM API calls (temperature=0, fixed seed) via provider strategy
  - Structured verdict parsing
  - Multi-run execution (3-5 runs), ICC computation
  - Unstable function flagging
  - Rubric-based evaluation
  - Full audit logging
- **S4**: LLM provider strategy factory
  - ClaudeProvider, OpenAIProvider
  - Common retry/timeout, concurrency governor (p-limit)
  - Exponential backoff for 429/5xx
- **S5**: Audit log service
  - LLM call logging (context, prompt, response)
  - VCR mode (record/replay/bypass) for deterministic testing
- Validate: full pipeline from fixture -> extract -> ingest -> compile -> route -> evaluate against golden test data

**Deliverables**:
- Router dispatching to symbolic and neuronal paths
- Symbolic evaluation engine executing Cypher
- LLM Critic with multi-run ICC and VCR support
- Provider adapters (Claude + OpenAI)
- BDD features: routing rules, symbolic evaluation, neuronal evaluation, hybrid flow, symbolic-only mode, neuronal-only mode
- TDD unit tests (mocked LLM for unit, VCR cassettes for integration)
- Integration test: end-to-end evaluation of fixture projects through both paths

**Stories**: US-8.1-US-8.3, US-9.1-US-9.2, US-10.1-US-10.8, US-11.1-US-11.2

---

## Unit 6: Scoring Engine + Reports

**Components**: C8 (Scoring Engine), S6 (ReportService)

**Scope**:
- **C8**: Score computation
  - Verdict merge logic (hard block / soft block / warning / pass)
  - Confidence calibration (high >= 0.85, medium 0.60-0.85, low < 0.60)
  - AVR per dimension
  - AHS weighted complement (7 dimensions + Layer C weights)
  - Dual scoring: ahs_deterministic, ahs_combined, ahs_neuronal (neuronal-only mode)
  - Universal health metrics (cycles, fan-out, fan-in, abstraction ratio, instability, orphans)
  - Route and determinism tagging
- **S6**: Report generation
  - JSON report (full structured output)
  - Human-readable summary (CLI + PR comment)
  - CSV row (batch evaluation)
  - PR comment markdown format
- Validate: score golden test data, verify AHS discrimination (clean > violated), verify precision/recall against manifests

**Deliverables**:
- `computeScores()` producing EvaluationReport
- ReportService with all 4 output formats
- BDD features: AVR computation, AHS computation, dual scoring, verdict merge, report formats
- TDD unit tests for each scoring function
- Integration test: full pipeline -> score -> verify AHS >= 0.90 for clean fixtures, violations detected for seeded fixtures

**Stories**: US-12.1-US-12.5, US-13.1-US-13.3, US-NFR-1, US-NFR-3

---

## Unit 7: CLI + CI/CD + Pipeline Orchestration

**Components**: C9 (CLI), S1 (PipelineExecutor), GitHub Action, Batch Runner

**Scope**:
- **S1**: PipelineExecutor
  - Command pattern: build command sequence from config
  - Execute commands with parallel branch support (C1||C3, C6||C7)
  - Pipeline context management (FirewallContext)
  - Critical error fail-fast, warning accumulation
  - Pipeline timing and logging
- **C9**: CLI with Commander.js
  - `firewall evaluate` — single project evaluation
  - `firewall batch` — batch evaluation with CSV output
  - `firewall drift` — drift report between snapshots
  - All flags: --project, --spec, --format, --verbose, --neo4j-uri, --symbolic-only, --neuronal-only, --persist, --diff
  - Exit codes: 0 (pass), 1 (violations), 2 (error)
  - JSON to stdout, human summary to stderr
- **GitHub Action**: `.github/actions/firewall/action.yml`
  - Trigger on pull_request events
  - Neo4j service container
  - PR comment with results
  - Check status based on AHS threshold
  - Manual trigger via `/firewall` command
  - Configurable mode (symbolic-only vs full)
- **Batch Runner**: FR-16
  - Sequential N-project evaluation
  - CSV output, skip failed projects
  - Performance: < 5s per project symbolic-only
- Validate: end-to-end CLI runs against fixture projects, GitHub Action workflow test

**Deliverables**:
- PipelineExecutor orchestrating full pipeline
- CLI with all 3 commands and flags
- GitHub Action workflow
- Batch runner with CSV output
- BDD features: CLI commands, exit codes, output formats, GitHub Action trigger
- TDD unit tests for executor, CLI handlers
- Integration test: `firewall evaluate` end-to-end, `firewall batch` against fixtures
- NFR validation: performance targets, developer experience (< 5 min install-to-eval)

**Stories**: US-14.1-US-14.5, US-15.1-US-15.6, US-16.1-US-16.4, US-NFR-2, US-NFR-4, US-NFR-5, US-NFR-6

---

## Build Order Summary

```
Unit 0: Infrastructure Scaffolding
  |
  v
Unit 1: Shared Domain + Validation Set (C10, C11, FR-17)
  |
  +-------+-------+
  |               |
  v               v
Unit 2: APG      Unit 3: Spec Parser +
Extractor (C1)   Fitness Compiler (C3, C4)
  |               |
  +-------+-------+
          |
          v
Unit 4: Neo4j Ingestion + Persistence (C2, S2, S3)
          |
          v
Unit 5: Router + Evaluation Paths (C5, C6, C7, S4, S5)
          |
          v
Unit 6: Scoring Engine + Reports (C8, S6)
          |
          v
Unit 7: CLI + CI/CD + Pipeline Orchestration (C9, S1, GitHub Action)
```

**Note**: Units 2 and 3 can be built in parallel (no dependency between them). All other units are sequential.

---

## Code Organization (Greenfield)

```
src/
  shared/              # Unit 1: C10 domain types + C11 FirewallContext
    context/           # C11: FirewallContext aggregate
    types/             # Domain types, value objects
    interfaces/        # GraphRepository, LLMProvider, etc.
    errors/            # DomainResult, PipelineError
    taxonomy/          # Violation taxonomy
  apg-extractor/       # Unit 2: C1
  spec-parser/         # Unit 3: C3
  fitness-compiler/    # Unit 3: C4
  neo4j-ingestion/     # Unit 4: C2
  neuro-symbolic-router/ # Unit 5: C5
  evaluation-engine/   # Unit 5: C6
  llm-critic/          # Unit 5: C7
  scoring-engine/      # Unit 6: C8
  cli/                 # Unit 7: C9
  pipeline/            # Unit 7: S1 PipelineExecutor
  services/            # S2-S6 (co-located with using units)
tests/
  features/            # BDD Gherkin files (per unit)
  unit/                # TDD unit tests (mirrors src/)
  integration/         # Integration tests (Neo4j, LLM, pipeline)
fixtures/              # Unit 1: Sample projects + manifests
specs/                 # Unit 1: Sample AoC YAML specs
.github/               # Unit 7: GitHub Action + CI
docker-compose.yml     # Unit 0: Neo4j setup
```
