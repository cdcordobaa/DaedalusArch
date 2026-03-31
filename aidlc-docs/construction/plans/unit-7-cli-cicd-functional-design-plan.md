# Functional Design Plan — U7: CLI + CI/CD + Pipeline Orchestration

## Unit Context
- **Components**: C9 (CLI), S1 (PipelineExecutor), GitHub Action, Batch Runner
- **Stories**: US-14.1–14.5, US-15.1–15.6, US-16.1–16.4, US-NFR-2, US-NFR-4, US-NFR-5, US-NFR-6
- **Dependencies**: All prior units (U0–U6) — this is the top-level orchestration layer

---

## Design Plan

### Business Logic Modeling
- [x] **BL-1**: PipelineExecutor command-sequence builder — how to compose the 6 pipeline stages into an ordered Command list based on EvaluationMode and PipelineMode
- [x] **BL-2**: Parallel branch dispatch — C1||C3 (extraction + parsing), C6||C7 (symbolic + neuronal) execution strategy
- [x] **BL-3**: CLI command routing — `evaluate`, `batch`, `drift` command handlers and their option-to-config mapping
- [x] **BL-4**: Batch runner sequential execution with per-project isolation and CSV row accumulation
- [x] **BL-5**: Drift command — loading two snapshots, computing delta, generating drift report

### Domain Model
- [x] **DM-1**: PipelineConfig, EvaluateOptions, BatchOptions, DriftOptions value objects
- [x] **DM-2**: PipelineCommand adapters wrapping each PipelineStage into the Command pattern (reads from / writes to FirewallContext)
- [x] **DM-3**: StageTimings and PipelineResult aggregation types
- [x] **DM-4**: BatchResult and BatchRow types for multi-project output

### Business Rules
- [x] **BR-1**: Exit code determination — 0/1/2 logic based on verdict and error state
- [x] **BR-2**: Mode filtering — symbolic-only skips neuronal commands, neuronal-only skips symbolic evaluation
- [x] **BR-3**: Fail-fast vs warning accumulation — critical errors halt pipeline, warnings accumulate
- [x] **BR-4**: Batch graceful failure — failed projects produce error row, don't abort remaining
- [x] **BR-5**: GitHub Action check status — pass/fail based on AHS threshold comparison

### Data Flow
- [ ] **DF-1**: CLI argv → Commander.js parsed options → PipelineConfig → PipelineExecutor
- [ ] **DF-2**: PipelineExecutor → FirewallContext (shared state) → EvaluationReport
- [ ] **DF-3**: EvaluationReport → ReportService format → stdout (JSON) / stderr (human summary)
- [ ] **DF-4**: Batch flow — loop over project paths, fresh FirewallContext per project, accumulate BatchRows

---

## Questions

### Q1: Pipeline Command Composition Strategy
The PipelineExecutor needs to compose stages into commands. Two approaches:

**A) Static command lists** — Pre-defined command sequences per mode:
- `full`: [Extract, Parse, Ingest, Compile, Route+Evaluate, Score]
- `symbolic-only`: [Extract, Parse, Ingest, Compile, SymbolicEval, Score]
- `neuronal-only`: [Extract, Parse, Compile, NeuronalEval, Score]

**B) Dynamic builder** — Fluent builder API where CLI constructs the pipeline step-by-step based on flags

**C) Hybrid** — Static templates with flag-based overrides (e.g., `--persist` adds snapshot save)

[Answer]: C-ish (Pre-defined presets + Custom override capability)
Rationale: A hybrid approach offers the best developer experience. Pre-defined command lists (like `full` or `symbolic-only`) handle 90% of use cases out of the box, ensuring stability. However, exposing a dynamic builder or configuration layer allows advanced users to define their own custom command sequences when the defaults don't fit.
### Q2: Parallel Execution Model
For C1||C3 and C6||C7 parallel branches:

**A) Promise.all within a single ParallelCommand** — A `ParallelCommand` wraps two sub-commands and runs them via `Promise.all`. The PipelineExecutor sees it as one sequential step.

**B) Executor-level parallelism** — PipelineExecutor has a `parallel([cmd1, cmd2])` primitive in its command list, handling concurrency itself.

**C) No parallelism in v1** — Run all stages sequentially for simplicity; optimize later. (Negligible for symbolic-only since Cypher is fast.)

[Answer]: A (Promise.all within a ParallelCommand)
Rationale: Wrapping parallel execution within a dedicated `ParallelCommand` keeps the `PipelineExecutor` strictly sequential and ignorant of concurrency. This adheres tightly to the Command and Composite patterns, isolating complexity away from the central orchestrator.
### Q3: Service Instantiation and Wiring
The pipeline needs Neo4jRepository, SnapshotStore, LLMProvider instances. Who creates them?

**A) CLI creates all service instances** — CLI is the composition root, constructs all dependencies, injects into PipelineExecutor.

**B) PipelineExecutor creates services from config** — Executor receives PipelineConfig and instantiates services internally.

**C) Dependency injection container** — Lightweight DI container resolves services.

[Answer]: A-variant (Composition Root via Factory functions)
Rationale: While a full DI container (C) reduces boilerplate, it introduces runtime mapping complexities and hides dependencies. The pure Composition Root (A) enforces strict, compile-time type safety. By splitting the difference—using a dedicated factory function (e.g., `createPipeline(config)`) to instantiate the services—the CLI file remains clean and focused solely on argument parsing, while maintaining the explicit, magic-free wiring that the architecture demands.
### Q4: GitHub Action — Report Mechanism
How should the GitHub Action post results to the PR?

**A) Inline step with `gh` CLI** — Action runs `firewall evaluate`, captures JSON output, uses `gh pr comment` to post markdown summary.

**B) @actions/github API** — Action uses Octokit to create/update a PR comment programmatically (can update existing comment on re-run).

**C) Check Run annotation** — Use GitHub Checks API to create an annotation with the results (appears in PR checks tab, not as a comment).

**D) Both B + C** — PR comment for human summary + Check Run for structured pass/fail.

[Answer]: D (Both B + C)
Rationale: Providing a PR comment gives humans an immediate, easily readable summary of the architectural health without making them dig through logs. Providing the Check Run annotation simultaneously emits structured data that automation agents (like an auto-fix LLM) can easily ingest and act upon.
### Q5: Drift Command — Snapshot Selection
The `firewall drift` command needs two snapshots to compare. How should users specify them?

**A) Explicit commit SHAs** — `firewall drift --from abc123 --to def456`

**B) Latest vs current** — `firewall drift` always compares latest stored snapshot against a fresh evaluation of current code

**C) Both** — Support explicit `--from`/`--to` with default fallback to "latest vs current"

[Answer]: C (Both)
Rationale: Local development benefits immensely from the zero-config "latest vs current" fallback, providing instant drift feedback. CI/CD pipelines require absolute determinism, which is achieved by explicitly passing commit SHAs (`--from` and `--to`), representing the true delta built into the workflow.
