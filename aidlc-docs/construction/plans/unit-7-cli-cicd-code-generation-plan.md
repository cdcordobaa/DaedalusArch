# Unit 7 — CLI + CI/CD + Pipeline Orchestration: Code Generation Plan

## Steps

### Step 1: Create pipeline types (`src/pipeline/types.ts`)
- [x] `PipelineConfig`, `LLMConfig`, `StageTimingEntry`, `StageTimings`
- [x] `BatchRow`, `BatchResult`
- [x] `EvaluateOptions`, `BatchOptions`, `DriftOptions`, `OutputFormat`

### Step 2: Create PipelineCommand adapters (`src/pipeline/commands/`)
- [x] `extract-command.ts` — wraps `extractAPG()`, writes `context.setApgResult()`
- [x] `parse-command.ts` — wraps `parseSpec()`, writes `context.setParsedSpec()`
- [x] `ingest-command.ts` — wraps `ingestAPG()`, writes `context.setIngestionResult()`
- [x] `compile-command.ts` — wraps `compileFunctions()`, writes `context.setCompiledFunctions()`
- [x] `route-evaluate-command.ts` — wraps `routeAndEvaluate()`, writes `context.setEvaluationResults()`
- [x] `symbolic-evaluate-command.ts` — wraps `evaluateSymbolic()` directly (symbolic-only mode)
- [x] `neuronal-evaluate-command.ts` — wraps `evaluateNeuronal()` directly (neuronal-only mode)
- [x] `score-command.ts` — wraps `computeScores()`, writes `context.setReport()`
- [x] `snapshot-save-command.ts` — wraps `snapshotStore.saveSnapshot()` (--persist)
- [x] `snapshot-load-command.ts` — wraps `snapshotStore.loadSnapshot()` (--diff)
- [x] `drift-detect-command.ts` — wraps `computeDelta()` + `detectDrift()`
- [x] `parallel-command.ts` — composite: `Promise.all` over sub-commands
- [x] `commands/index.ts` — re-exports

### Step 3: Create PipelineExecutor (`src/pipeline/pipeline-executor.ts`)
- [x] Sequential command execution loop
- [x] Stage timing collection
- [x] Fail-fast on critical errors, warning accumulation
- [x] Graceful shutdown support (`requestShutdown()`)
- [x] Return `Result<EvaluationReport, PipelineError>`

### Step 4: Create pipeline factory (`src/pipeline/pipeline-factory.ts`)
- [x] `createPipeline(config: PipelineConfig)` → `{ executor, cleanup }`
- [x] Preset command sequences for full / symbolic-only / neuronal-only
- [x] Flag-based overrides (--persist → SnapshotSaveCommand, --diff → SnapshotLoad + DriftDetect)
- [x] Service instantiation (Neo4jRepository, FileSystemSnapshotStore, LLMProvider)
- [x] Cleanup function (close Neo4j pool)

### Step 5: Update pipeline index (`src/pipeline/index.ts`)
- [x] Public exports

### Step 6: Create CLI entry point (`src/cli/cli.ts`)
- [x] Commander.js program setup with 3 commands
- [x] `firewall evaluate` handler → EvaluateOptions → PipelineConfig → execute → format → exit code
- [x] `firewall batch` handler → BatchOptions → loop projects → accumulate rows → CSV/JSON output
- [x] `firewall drift` handler → DriftOptions → explicit SHA or latest-vs-current → drift report
- [x] Config resolution: CLI flags > env vars > .env > defaults
- [x] Mutual exclusion validation (--symbolic-only vs --neuronal-only)
- [x] stdout/stderr output routing (JSON/CSV to stdout, human/progress to stderr)
- [x] SIGINT/SIGTERM graceful shutdown handler

### Step 7: Create batch runner (`src/cli/batch-runner.ts`)
- [x] `discoverProjects(dir)` — find subdirectories with tsconfig.json/package.json
- [x] `runBatch(options)` — sequential execution, per-project isolation, error rows
- [x] CSV formatting with header row

### Step 8: Update CLI index (`src/cli/index.ts`)
- [x] Replace stub with real exports
- [x] Add bin entry point shim (`bin/firewall.ts` or update package.json bin)

### Step 9: Update GitHub Action (`/.github/actions/firewall/action.yml`)
- [x] Composite action: setup Node, npm ci, run firewall evaluate
- [x] Parse JSON output → extract AHS, verdict
- [x] PR comment via `@actions/github` (Octokit) with `<!-- firewall-report -->` marker
- [x] Check Run via Checks API (conclusion based on verdict)
- [x] Manual trigger support (`/firewall` comment command)
- [x] Inputs/outputs as defined in functional design

### Step 10: Update CI workflow (`.github/workflows/ci.yml`)
- [x] Add firewall evaluation step using the custom action
- [x] Neo4j service container configuration
- [x] Symbolic-only mode for CI speed

### Step 11: Unit tests (`tests/unit/pipeline/`)
- [x] PipelineExecutor: sequential execution, fail-fast, warning accumulation, shutdown
- [x] ParallelCommand: Promise.all, error propagation, timing
- [x] Each command adapter: context read/write, error mapping
- [x] Pipeline factory: preset selection, flag overrides, service wiring

### Step 12: Unit tests (`tests/unit/cli/`)
- [x] CLI argument parsing (all 3 commands, all flags)
- [x] Exit code determination (0/1/2)
- [x] Mode filtering (mutual exclusion error)
- [x] Batch project discovery
- [x] Config resolution order
- [x] Output routing (stdout vs stderr)

### Step 13: TypeCheck + full test run
- [x] `npx tsc --noEmit` → 0 errors
- [x] `npm test` → all passing (29 suites, 312 tests)

## Story Traceability
| Story | Coverage |
|-------|----------|
| US-14.1 | Step 6 (evaluate command) |
| US-14.2 | Step 7 (batch command) |
| US-14.3 | Step 6 (CLI flags) |
| US-14.4 | Step 6 (exit codes) |
| US-14.5 | Step 6 (Commander.js) |
| US-15.1 | Step 9 (GitHub Action on PR) |
| US-15.2 | Step 9 (PR comment) |
| US-15.3 | Step 9 (check status) |
| US-15.4 | Step 9 (manual trigger) |
| US-15.5 | Step 10 (Neo4j service container) |
| US-15.6 | Step 10 (configurable CI mode) |
| US-16.1 | Step 7 (sequential batch) |
| US-16.2 | Step 7 (CSV output) |
| US-16.3 | Step 7 (graceful failure) |
| US-16.4 | Step 12 (batch performance test) |
| US-NFR-2 | Steps 3-4 (performance: timing, parallel) |
| US-NFR-4 | Steps 3, 6 (resilience: fail-fast, shutdown) |
| US-NFR-5 | Steps 9-10 (reproducible environment) |
| US-NFR-6 | Steps 6, 8 (developer experience) |
