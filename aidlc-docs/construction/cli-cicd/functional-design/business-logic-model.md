# Business Logic Model — U7: CLI + CI/CD + Pipeline Orchestration

## BL-1: Pipeline Command-Sequence Composition (Hybrid Preset + Override)

### Preset Command Sequences

Three built-in presets cover 90% of usage. Each preset is an ordered list of `PipelineCommand` instances.

**Full mode** (default):
```
1. ParallelCommand([ExtractCommand, ParseCommand])   // C1 || C3
2. IngestCommand                                       // C2
3. CompileCommand                                      // C4
4. RouteAndEvaluateCommand                             // C5 → ParallelCommand([C6, C7])
5. ScoreCommand                                        // C8
```

**Symbolic-only mode** (`--symbolic-only`):
```
1. ParallelCommand([ExtractCommand, ParseCommand])
2. IngestCommand
3. CompileCommand
4. SymbolicEvaluateCommand                             // C6 only, no C7
5. ScoreCommand
```

**Neuronal-only mode** (`--neuronal-only`):
```
1. ParallelCommand([ExtractCommand, ParseCommand])
2. IngestCommand
3. CompileCommand
4. NeuronalEvaluateCommand                             // C7 only, no C6
5. ScoreCommand
```

### Flag-Based Overrides

Overlaid on top of any preset:
- `--persist` → appends `SnapshotSaveCommand` after ScoreCommand
- `--diff` → prepends `SnapshotLoadCommand`, appends `DriftDetectCommand` after ScoreCommand

### Factory Function

```
createPipeline(config: PipelineConfig): PipelineExecutor
```

The factory function:
1. Selects preset based on `config.evaluationMode`
2. Applies flag-based overrides (`persist`, `diff`)
3. Instantiates all service dependencies (Neo4jRepository, SnapshotStore, LLMProvider)
4. Injects services into Command constructors
5. Returns a fully wired PipelineExecutor

---

## BL-2: Parallel Branch Dispatch (ParallelCommand)

### ParallelCommand (Composite Pattern)

A `ParallelCommand` implements `PipelineCommand` and wraps N sub-commands:

```
class ParallelCommand implements PipelineCommand {
  name: "parallel:<sub1>+<sub2>"
  commands: PipelineCommand[]
  
  execute(context):
    results = await Promise.all(commands.map(c => c.execute(context)))
    if any result is critical error → return first critical error
    merge all warnings into context
    return success
}
```

**Parallel points in the pipeline**:
- **Extraction + Parsing**: `ParallelCommand([ExtractCommand, ParseCommand])` — no shared state dependency, both write to different FirewallContext slots
- **Symbolic + Neuronal evaluation**: Inside `RouteAndEvaluateCommand`, the Router (C5) internally dispatches C6||C7 via `Promise.all` — this is already implemented in the Router module. The executor sees RouteAndEvaluateCommand as one sequential step.

### Error Semantics in Parallel
- If **any** sub-command returns a critical error → ParallelCommand fails immediately (first error wins)
- If sub-commands return warnings → all warnings are accumulated into context
- Timing: ParallelCommand records wall-clock time for the group, sub-commands record individual times

---

## BL-3: CLI Command Routing

### Command: `firewall evaluate`

```
firewall evaluate --project <path> --spec <path> [options]

Options:
  --project <path>       Path to TypeScript project (required)
  --spec <path>          Path to AoC YAML spec (required)
  --format <fmt>         Output format: json | human | csv (default: human)
  --verbose              Enable verbose logging to stderr
  --neo4j-uri <uri>      Neo4j bolt URI (default: bolt://localhost:7687)
  --symbolic-only        Run symbolic evaluation only
  --neuronal-only        Run neuronal evaluation only
  --persist              Save snapshot after evaluation
  --diff                 Compare against latest snapshot

Flow:
  1. Parse argv → EvaluateOptions
  2. Validate required options (project exists, spec exists)
  3. Load .env for defaults (NEO4J_URI, ANTHROPIC_API_KEY, OPENAI_API_KEY)
  4. Call createPipeline(config) → PipelineExecutor
  5. executor.execute() → Result<EvaluationReport, PipelineError>
  6. On success: format report → stdout (JSON) or stderr (human), set exit code
  7. On error: print error to stderr, exit 2
  8. Cleanup: close Neo4j connection pool
```

### Command: `firewall batch`

```
firewall batch --dir <path> --spec <path> [options]

Options:
  --dir <path>           Directory containing project subdirectories (required)
  --spec <path>          Path to AoC YAML spec (required)
  --format <fmt>         Output format: json | csv (default: csv)
  --neo4j-uri <uri>      Neo4j bolt URI
  --symbolic-only        Run symbolic evaluation only
  --verbose              Enable verbose logging

Flow:
  1. Parse argv → BatchOptions
  2. Discover project subdirectories under --dir
  3. For each project (sequential):
     a. Create fresh FirewallContext (isolation)
     b. Create fresh PipelineExecutor
     c. Execute pipeline
     d. On success: accumulate BatchRow (project, AHS, verdict, duration)
     e. On failure: accumulate error row (project, "ERROR", error message)
     f. Clear Neo4j graph (stateless per project)
  4. Output: CSV to stdout (with header row), summary to stderr
  5. Exit code: 0 if all pass, 1 if any violations, 2 if any errors
```

### Command: `firewall drift`

```
firewall drift [options]

Options:
  --project <path>       Path to TypeScript project (required for "latest vs current")
  --spec <path>          Path to AoC YAML spec (required for "latest vs current")
  --from <sha>           Source snapshot commit SHA (optional)
  --to <sha>             Target snapshot commit SHA (optional)
  --format <fmt>         Output format: json | human (default: human)
  --neo4j-uri <uri>      Neo4j bolt URI

Flow (explicit SHAs):
  1. Load snapshot for --from SHA
  2. Load snapshot for --to SHA
  3. Compute delta between snapshots
  4. Run drift detection algorithms
  5. Format and output drift report

Flow (latest vs current — default):
  1. Load latest stored snapshot
  2. Run full evaluate pipeline on current project
  3. Compute delta between latest snapshot and current APG
  4. Run drift detection
  5. Format and output drift report
  6. If --persist: save new snapshot
```

---

## BL-4: Batch Runner

### Sequential Execution Model

```
for each projectPath in discoverProjects(dir):
  context = new FirewallContext(generateRunId())
  executor = createPipeline({ ...batchConfig, projectPath })
  result = await executor.execute()
  
  if result.isSuccess():
    rows.push(toBatchRow(projectPath, result.value))
  else:
    rows.push(toErrorRow(projectPath, result.error))
    errorCount++
  
  await graphRepository.clearGraph()   // stateless: clean between projects
```

### Project Discovery

```
discoverProjects(dir: string): string[]
  - List immediate subdirectories of dir
  - Filter: must contain tsconfig.json or package.json
  - Sort alphabetically for deterministic order
  - Return absolute paths
```

### Performance Target
- < 5s per project in symbolic-only mode (US-NFR-2)
- Neo4j graph clear between projects ensures isolation

---

## BL-5: Drift Command

### Dual-Mode Snapshot Selection (C: Both)

**Explicit mode** (CI/CD determinism):
- Both `--from` and `--to` required
- Load snapshots from SnapshotStore by commit SHA
- Error if snapshot not found

**Default mode** (developer convenience):
- No `--from`/`--to` flags
- Load latest snapshot from store
- Run fresh evaluation on current project (requires `--project` and `--spec`)
- Compare fresh APG against stored snapshot
- Error if no previous snapshot exists (first run)

### Drift Report Contents
- Structural drift (nodes added/removed/modified)
- Coupling drift (fan-in/fan-out changes)
- Convention drift (naming/decorator violations trending)
- Violation trend (new violations, resolved violations, persistent)
- Overall drift severity rating

---

## BL-6: Pipeline Timing and Logging

### Stage Timing

Each PipelineCommand records:
- `stageName`: command name
- `startedAt`: ISO timestamp
- `durationMs`: wall-clock milliseconds
- `status`: "success" | "warning" | "error"

PipelineExecutor aggregates into `StageTimings`:
```
{
  stages: [{ name, durationMs, status }],
  totalMs: number,
  parallelSavingsMs: number  // time saved by parallel execution
}
```

### Verbose Logging

When `--verbose` is active:
- Each command logs start/complete to stderr via `ora` spinner
- Warnings are printed inline as they occur
- Stage timings printed as summary table after completion

---

## BL-7: GitHub Action Orchestration

### Composite Action Flow

```yaml
# .github/actions/firewall/action.yml (composite action)
1. Setup Node.js 20
2. Install firewall dependencies (npm ci)
3. Run: firewall evaluate --project ${{ inputs.project-path }} --spec ${{ inputs.spec-path }} --format json --neo4j-uri ${{ inputs.neo4j-uri }} --symbolic-only|full based on inputs.evaluation-mode
4. Capture JSON output
5. Parse JSON → extract AHS, verdict, violations summary
6. Create/update PR comment via @actions/github (Octokit)
   - Marker comment: <!-- firewall-report --> for idempotent updates
   - Markdown: AHS badge, verdict, top violations, link to full report
7. Create Check Run via Checks API
   - conclusion: "success" | "failure" based on verdict
   - output.title: "Architectural Health: {AHS}"
   - output.summary: violation count per dimension
   - annotations: file-level violations (max 50)
8. Set outputs: ahs-score, verdict, report-path
```

### Manual Trigger

Supports `/firewall` comment command via `issue_comment` event:
- Action filters for `/firewall` in comment body
- Extracts optional flags from comment (e.g., `/firewall --neuronal-only`)
- Runs evaluation and posts result as reply comment
