# Application Design Plan — Architectural Firewall (DaedalusArch)

## Plan Overview

Design the high-level component architecture for 8 bounded context modules + CLI + shared domain types. Define interfaces, dependencies, communication patterns, and service orchestration.

---

## Execution Checklist

- [x] Step 1: Analyze context (requirements + stories loaded)
- [x] Step 2: Collect user input on design decisions (questions below)
- [x] Step 3: Analyze answers for ambiguities — no issues found
- [x] Step 4: Generate design artifacts
  - [x] 4a: components.md — 10 components (C1-C10)
  - [x] 4b: component-methods.md — method signatures and typed I/O
  - [x] 4c: services.md — 6 services (S1-S6) with orchestration
  - [x] 4d: component-dependency.md — dependency matrix, data flow, ACLs
  - [x] 4e: application-design.md — consolidated design document
- [ ] Step 5: Review and approval

---

## Application Design Questions

Please answer the following questions to guide component design.

---

### Question 1
**How should the pipeline modules communicate?** The firewall is a sequential pipeline (extract -> ingest -> compile -> route -> evaluate -> score -> report). How should data flow between stages?

A) Direct function calls — each module exports functions, a central orchestrator calls them in sequence passing results forward. Simple, synchronous, easy to debug.
B) Pipeline pattern with typed intermediate representations — each module consumes a typed input and produces a typed output. Modules are composable and independently testable.
C) Event-driven — modules emit events, a mediator coordinates the pipeline. Loose coupling but harder to trace.
X) Other (please describe after [Answer]: tag below)
[Answer]: B (Pipeline pattern with typed intermediate representations)


---

### Question 2
**How should the pipeline be orchestrated?** Who controls the sequence of module execution?

A) Single orchestrator service (`PipelineOrchestrator`) that knows the full sequence and calls each module. Central error handling and logging.
B) Chain-of-responsibility — each module knows the next module and passes results forward. Decentralized.
C) Command pattern — each pipeline stage is a command object. An executor runs commands in sequence. Supports undo/retry.
X) Other (please describe after [Answer]: tag below)
[Answer]: C (Command pattern — stage objects with parallel/branching support)


---

### Question 3
**How should Neo4j connections be managed?** The pipeline needs Neo4j for ingestion, evaluation, and universal metrics.

A) Connection pool — a shared pool managed by a `GraphRepository` (DDD repository pattern). Modules request connections from the pool.
B) Single connection — one connection created at pipeline start, passed through to modules that need it. Simple for CLI use.
C) Per-module connections — each module that needs Neo4j creates and manages its own connection. Maximum isolation.
X) Other (please describe after [Answer]: tag below)
[Answer]: A (Connection pool managed by a GraphRepository - DDD pattern)


---

### Question 4
**How should the APG snapshot storage be implemented?** FR-03.3 defines the APG_Store directory structure. Where should snapshots be persisted?

A) Filesystem only — JSON files in `APG_Store/` directory relative to the project being evaluated. Simple, portable, no additional dependencies.
B) Neo4j + Filesystem — graph data in Neo4j (labeled by commit SHA), metadata/drift reports as JSON files. Leverages the existing database.
C) Filesystem with optional Neo4j persistence — default to filesystem, with a flag to persist snapshots in Neo4j for teams that want queryable history.
X) Other (please describe after [Answer]: tag below)
[Answer]: B (Neo4j + Filesystem — graph as historical aggregate store)


---

### Question 5
**How should the LLM Critic Agent handle provider abstraction?** FR-10.4 requires configurable LLM providers (Claude, GPT-4o, others).

A) Adapter pattern — a `LLMProvider` interface with concrete adapters (`ClaudeAdapter`, `OpenAIAdapter`). New providers added by implementing the interface.
B) Strategy pattern — similar to adapter but with a factory that selects the strategy based on configuration. Includes common retry/timeout logic in the base.
C) Plugin system — providers are loaded dynamically from configuration. Maximum extensibility but more complex.
X) Other (please describe after [Answer]: tag below)
[Answer]: B (Strategy pattern with factory — isolation of LLM infrastructure)


---

### Question 6
**How should errors propagate across the pipeline?** When a module fails mid-pipeline, what happens?

A) Fail-fast with typed errors — pipeline stops immediately on any critical error. Non-critical errors (e.g., single file parse failure) are collected and reported. Uses a typed `Result<T, E>` pattern.
B) Accumulate and continue — pipeline continues through all stages, collecting errors. Final report includes all errors. Maximum information but may produce invalid downstream results.
C) Fail-fast for critical, accumulate for warnings — critical errors (Neo4j down, spec invalid) stop the pipeline. Warnings (file parse skip, ADR not found) accumulate and appear in the report.
X) Other (please describe after [Answer]: tag below)
[Answer]: C (Fail-fast for critical, accumulate for warnings — supports partial models)


---

---
