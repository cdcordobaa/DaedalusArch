# Application Design — Architectural Firewall (DaedalusArch)

## Design Summary

The Architectural Firewall is structured as a **typed pipeline** of 8 bounded context modules orchestrated by a **Command pattern executor**. Each module consumes a typed input and produces a typed output. The pipeline supports parallel execution (extraction || spec parsing, symbolic || neuronal evaluation) and branching (neuro-symbolic router dispatches to different paths).

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Pipeline communication | Typed intermediate representations | Composable, independently testable, clear contracts |
| Orchestration | Command pattern (PipelineExecutor) | Supports parallel/branching, stage isolation, retry potential |
| Neo4j connections | Connection pool via GraphRepository | DDD repository pattern, efficient resource sharing |
| Snapshot storage | Neo4j + Filesystem hybrid | Graph data queryable in Neo4j, metadata portable on filesystem |
| LLM provider | Strategy pattern with factory | Clean provider swapping, common retry/timeout in base |
| Error propagation | Fail-fast critical, accumulate warnings | Critical stops pipeline, warnings flow to final report |

---

## Technical Design Patterns (DDD Hardening)

To ensure **DaedalusArch** follows strict **METH-01 (BDD)**, **METH-02 (TDD)**, and **METH-03 (DDD)** requirements, the following patterns are enforced across all bounded contexts:

### 1. `FirewallContext` (Domain State Carrier)
The pipeline is **stateless** between runs but **context-aware** during a run. A central **`FirewallContext`** object travels through the commands.
- **Aggregate Root**: The context contains the `ApgNodeMap`, `AppliedAoCSpec`, `EvaluationVerdicts`, and `PipelineAuditLog`.
- **Value Objects**: Terms like `AVR`, `AHS`, and `Violation` are strictly-typed Value Objects within the context.

### 2. Dependency Inversion (IoC Strategy)
All 10 components and 6 services are wired using **Constructor Injection**.
- **Interfaces over Implementation**: Components interact via interfaces (e.g., `IGraphRepository`).
- **Mockability**: This ensures 100% unit test coverage by allowing us to swap the real `Neo4jIngestion` for a `MockIngestor` during BDD cycles.

### 3. `DomainResult<T>` (Universal Result Model)
Every command and service method returns a standard `DomainResult` object:
- `{ success: boolean, data?: T, errors?: DomainError[], warnings?: DomainWarning[] }`.
- This ensures consistent error accumulation and propagation across the **Typed IRs (Q1: B)**.

### 4. Concurrency Throttling (The Governor)
The **`PipelineExecutor` (S1)** includes a **Concurrency Governor** for the **Neuronal Path (C7)**.
- **Async Execution**: While symbolic Cypher queries run in parallel, LLM calls are throttled to a configurable `maxConcurrentCalls` limit to avoid rate-limit (429) errors.

### 5. VCR Pattern (Statistical Reproducibility)
To enable **METH-01 (BDD)** for the non-deterministic neuronal path:
- **Recording**: LLM verdicts can be recorded into a "Neuronal Cassette" (JSON).
- **Replay**: During CI/CD tests, the `NeuronalPathCommand` can replay these cassettes to ensure 100% deterministic and free testing.

### 6. Spec Schema Versioning
The **Spec Parser (C3)** performs a `schema_version` handshake with the **AoC YAML**.
- This prevents execution if a user attempts to run an legacy spec against a newer, incompatible version of the firewall engine.

---

## Architecture Overview

```
+----------------------------------------------------------+
|                       CLI (C9)                            |
|  Commands: evaluate | batch | drift                      |
+---------------------------+------------------------------+
                            |
                            v
+----------------------------------------------------------+
|              PipelineExecutor (S1)                        |
|  Command pattern: sequential + parallel branches         |
+---+---------------------------+--------------------------+
    |                           |
    v                           v
+----------------+     +----------------+
| APG Extractor  |     | Spec Parser    |      PARALLEL
| (C1)           |     | (C3)           |
+-------+--------+     +---+----+-------+
        |                   |    |
        | APGResult         |    | ParsedSpec
        v                   |    v
+-------------------+       | +------------------+
| Neo4j Ingestion   |<------+ | Fitness Compiler |
| (C2)              |         | (C4)             |
+--------+----------+         +--------+---------+
         |                             |
         | Graph loaded                | CompiledFunctions
         v                            v
+--------------------------------------------------+
|         Neuro-Symbolic Router (C5)                |
|  Dispatches based on route tags                   |
+----------+-----------------------+---------------+
           |                       |
           v                       v
  +----------------+     +------------------+
  | Eval Engine    |     | LLM Critic Agent |   PARALLEL
  | Symbolic (C6)  |     | Neuronal (C7)    |
  +-------+--------+     +--------+---------+
          |                        |
          | SymbolicResults        | NeuronalResults
          +----------+-------------+
                     |
                     v
          +-------------------+
          | Scoring Engine    |
          | (C8)              |
          +--------+----------+
                   |
                   v
          +-------------------+
          | EvaluationReport  |
          +-------------------+
```

---

## Components (10)

| ID | Component | Module Path | Bounded Context |
|----|-----------|------------|-----------------|
| C1 | APG Extractor | `src/apg-extractor/` | ts-morph parsing, AST traversal |
| C2 | Neo4j Ingestion | `src/neo4j-ingestion/` | Graph DB ops, layers, delta, drift |
| C3 | Spec Parser | `src/spec-parser/` | AoC YAML + ADR parsing |
| C4 | Fitness Compiler | `src/fitness-compiler/` | Cypher compilation |
| C5 | Neuro-Symbolic Router | `src/neuro-symbolic-router/` | Route dispatch |
| C6 | Evaluation Engine | `src/evaluation-engine/` | Symbolic Cypher execution |
| C7 | LLM Critic Agent | `src/llm-critic/` | Neuronal LLM evaluation |
| C8 | Scoring Engine | `src/scoring-engine/` | AVR/AHS, verdict merge, reports |
| C9 | CLI | `src/cli/` | Commander.js commands |
| C10 | Shared Domain | `src/shared/` | Types, interfaces, value objects |
| C11 | Firewall Context | `src/shared/context/` | Aggregates project state per eval |

---

## Services (6)

| ID | Service | Purpose |
|----|---------|---------|
| S1 | PipelineExecutor | Command Dispatcher & Concurrency Governor |
| S2 | GraphRepositoryService | Neo4j connection pool + repository interface |
| S3 | SnapshotService | APG snapshot persistence (Neo4j + filesystem) |
| S4 | LLMProviderService | Strategy factory for Claude/OpenAI providers |
| S5 | AuditLogService | LLM call + pipeline event logging |
| S6 | ReportService | JSON/human/CSV/PR-comment output formatting |

---

## Pipeline Execution Modes

### Mode 1: Stateless Single Evaluation (CLI default)
```
Extract -> Parse Spec -> Clear Graph -> Ingest -> Compile -> Route -> Evaluate -> Score -> Report
```
- Graph cleared before ingestion (ADR-010)
- No snapshots, no drift detection
- Exit codes: 0 (pass), 1 (violations), 2 (error)

### Mode 2: Persistent Evaluation (CI/CD, `--mode persistent`)
```
Extract -> Parse Spec -> Load Previous Snapshot -> Delta Ingest -> Compile -> Route -> Evaluate -> Score -> Persist Snapshot -> Drift Detect -> Report
```
- Delta APG: only recompute changed files
- Snapshot persisted with commit SHA
- Drift detection against previous snapshot
- Drift alerts included in PR comment

### Mode 3: Symbolic-Only (`--symbolic-only`)
- Same as Mode 1 or 2, but Router skips all neuronal dispatch
- Only symbolic and hybrid-symbolic results
- All results `deterministic: true`
- Semantic/intent dimensions excluded from AHS

### Mode 3b: Neuronal-Only (`--neuronal-only`)
- Same as Mode 1 or 2, but Router skips all symbolic dispatch
- Only neuronal and hybrid-neuronal results
- Structural/coupling/pattern/convention dimensions excluded from AHS
- Used for ablation comparison: isolate LLM Critic coverage and accuracy

### Mode 4: Batch (`firewall batch`)
- Iterates Mode 1 over N projects
- CSV output with one row per project
- Failed projects skipped, reported in output

### Mode 5: Drift Report (`firewall drift --from SHA --to SHA`)
- Load two snapshots from SnapshotService
- Compute drift across 4 types
- Output drift report

---

## Error Handling Strategy

| Error Type | Severity | Action | Example |
|-----------|----------|--------|---------|
| Neo4j connection failure | Critical | Pipeline stops, exit code 2 | Connection refused |
| Spec validation failure | Critical | Pipeline stops, exit code 2 | Missing required field |
| Full extraction failure | Critical | Pipeline stops, exit code 2 | Project path not found |
| File parse skip | Warning | Accumulate, report in coverage | Missing dependency |
| ADR ref not found | Warning | Accumulate, proceed without prose | File moved/deleted |
| Unstable ICC | Warning | Accumulate, downweight in score | ICC < 0.70 |
| LLM API timeout | Warning (per-call) | Retry per strategy, then skip function | API rate limit |
| LLM API total failure | Critical | Pipeline stops if no neuronal results possible | API key invalid |

All errors use `Result<T, E>` pattern from C10 (Shared Domain).

---

## Cross-Reference

- **Full component details**: `components.md`
- **Method signatures**: `component-methods.md`
- **Service orchestration**: `services.md`
- **Dependency matrix and data flow**: `component-dependency.md`
- **Requirements traceability**: `../requirements/requirements.md` (FR-01 through FR-17)
- **User stories**: `../user-stories/stories.md` (81 stories across 17 epics)
