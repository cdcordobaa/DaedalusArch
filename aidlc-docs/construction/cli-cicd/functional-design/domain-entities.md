# Domain Entities — U7: CLI + CI/CD + Pipeline Orchestration

## Value Objects

### PipelineConfig

```typescript
interface PipelineConfig {
  readonly projectPath: string;
  readonly specFilePath: string;
  readonly neo4jUri: string;
  readonly neo4jUser: string;
  readonly neo4jPassword: string;
  readonly evaluationMode: EvaluationMode;       // 'full' | 'symbolic-only' | 'neuronal-only'
  readonly pipelineMode: PipelineMode;            // 'stateless' | 'persistent'
  readonly persist: boolean;                       // save snapshot after eval
  readonly diff: boolean;                          // compare against latest snapshot
  readonly commitSha?: CommitSha;                  // for snapshot tagging
  readonly llmConfig?: LLMConfig;                  // provider selection, API keys
  readonly verbose: boolean;
}
```

### LLMConfig

```typescript
interface LLMConfig {
  readonly provider: 'claude' | 'openai';
  readonly apiKey: string;
  readonly model?: string;                         // override default model
  readonly temperature?: number;                   // default: 0
  readonly seed?: number;                          // default: 42
  readonly maxConcurrency?: number;                // default: 3 (p-limit)
}
```

### EvaluateOptions

```typescript
interface EvaluateOptions {
  readonly project: string;
  readonly spec: string;
  readonly format: OutputFormat;
  readonly verbose: boolean;
  readonly neo4jUri: string;
  readonly symbolicOnly: boolean;
  readonly neuronalOnly: boolean;
  readonly persist: boolean;
  readonly diff: boolean;
}
```

### BatchOptions

```typescript
interface BatchOptions {
  readonly dir: string;
  readonly spec: string;
  readonly format: 'json' | 'csv';
  readonly verbose: boolean;
  readonly neo4jUri: string;
  readonly symbolicOnly: boolean;
  readonly neuronalOnly: boolean;
}
```

### DriftOptions

```typescript
interface DriftOptions {
  readonly project?: string;                       // required for default mode
  readonly spec?: string;                          // required for default mode
  readonly from?: string;                          // commit SHA (explicit mode)
  readonly to?: string;                            // commit SHA (explicit mode)
  readonly format: 'json' | 'human';
  readonly neo4jUri: string;
  readonly persist: boolean;
}
```

### OutputFormat

```typescript
type OutputFormat = 'json' | 'human' | 'csv';
```

---

## Aggregation Types

### StageTimingEntry

```typescript
interface StageTimingEntry {
  readonly name: string;
  readonly durationMs: number;
  readonly status: 'success' | 'warning' | 'error' | 'skipped';
}
```

### StageTimings

```typescript
interface StageTimings {
  readonly stages: readonly StageTimingEntry[];
  readonly totalMs: number;
}
```

### PipelineResult

```typescript
type PipelineResult = Result<EvaluationReport, PipelineError>;
```

### BatchRow

```typescript
interface BatchRow {
  readonly projectPath: string;
  readonly ahsDeterministic: number;
  readonly ahsCombined: number | null;
  readonly verdict: OverallVerdict | 'ERROR';
  readonly violationCount: number;
  readonly durationMs: number;
  readonly error?: string;
}
```

### BatchResult

```typescript
interface BatchResult {
  readonly rows: readonly BatchRow[];
  readonly totalProjects: number;
  readonly passCount: number;
  readonly failCount: number;
  readonly errorCount: number;
  readonly totalDurationMs: number;
}
```

---

## Command Classes (Command Pattern)

All commands implement `PipelineCommand` from `src/shared/interfaces/pipeline-stage.ts`.

### ExtractCommand

```
Reads: config.projectPath
Writes: context.setApgResult()
Wraps: extractAPG() from apg-extractor
```

### ParseCommand

```
Reads: config.specFilePath
Writes: context.setParsedSpec()
Wraps: parseSpec() from spec-parser
```

### IngestCommand

```
Reads: context.getApgResult(), context.getParsedSpec() (for layer mappings)
Writes: context.setIngestionResult()
Wraps: ingestAPG() from neo4j-ingestion
Dependencies: GraphRepository (injected)
```

### CompileCommand

```
Reads: context.getParsedSpec()
Writes: context.setCompiledFunctions()
Wraps: compileFunctions() from fitness-compiler
```

### RouteAndEvaluateCommand

```
Reads: context.getCompiledFunctions(), config.evaluationMode
Writes: context.setEvaluationResults()
Wraps: routeAndEvaluate() from neuro-symbolic-router
Dependencies: GraphRepository, LLMProvider (injected)
```

### SymbolicEvaluateCommand

```
Reads: context.getCompiledFunctions().symbolicQueries
Writes: context.setEvaluationResults() (neuronal results empty)
Wraps: evaluateSymbolic() from evaluation-engine
Dependencies: GraphRepository (injected)
```

### NeuronalEvaluateCommand

```
Reads: context.getCompiledFunctions().neuronalInstructions
Writes: context.setEvaluationResults() (symbolic results empty)
Wraps: evaluateNeuronal() from llm-critic
Dependencies: GraphRepository, LLMProvider (injected)
```

### ScoreCommand

```
Reads: context.getEvaluationResults(), scoring config
Writes: context.setReport()
Wraps: computeScores() from scoring-engine
Dependencies: GraphRepository (for universal metrics)
```

### SnapshotSaveCommand (optional, --persist)

```
Reads: context.getApgResult(), context.getReport()
Writes: to SnapshotStore (filesystem)
Wraps: snapshotStore.saveSnapshot()
Dependencies: SnapshotStore (injected)
```

### SnapshotLoadCommand (optional, --diff)

```
Reads: config.commitSha or "latest"
Writes: stores previous snapshot in context for later comparison
Wraps: snapshotStore.loadSnapshot() or snapshotStore.getLatestSnapshot()
Dependencies: SnapshotStore (injected)
```

### DriftDetectCommand (optional, --diff)

```
Reads: previous snapshot + current APG from context
Writes: drift report to context
Wraps: computeDelta() + detectDrift() from neo4j-ingestion
```

### ParallelCommand (Composite)

```
Reads/Writes: delegates to wrapped sub-commands
Contains: PipelineCommand[] (2+ commands)
Execution: Promise.all over sub-commands
Error: first critical error wins; warnings merged
Timing: wall-clock for group, individual for sub-commands
```

---

## PipelineExecutor (S1)

```typescript
class PipelineExecutor {
  private readonly commands: PipelineCommand[];
  private readonly context: FirewallContext;
  private readonly timings: StageTimingEntry[];
  private shutdownRequested: boolean;

  constructor(commands: PipelineCommand[], context: FirewallContext);

  execute(): Promise<Result<EvaluationReport, PipelineError>>;
  getTimings(): StageTimings;
  requestShutdown(): void;
}
```

### Execution Loop

```
for each command in commands:
  if shutdownRequested → break
  start = Date.now()
  result = await command.execute(context)
  duration = Date.now() - start
  
  if result is critical error:
    record timing (error)
    return Err(PipelineError with stage name, timings)
  
  record timing (success or warning)
  
return Ok(context.getReport())
```

---

## Factory Function

```typescript
function createPipeline(config: PipelineConfig): {
  executor: PipelineExecutor;
  cleanup: () => Promise<void>;
}
```

Returns:
- `executor`: fully wired PipelineExecutor with commands and services
- `cleanup`: async function that closes Neo4j pool and any other resources

The CLI calls `cleanup()` in a `finally` block to ensure resource release.

---

## GitHub Action Types

### ActionInputs

```typescript
interface ActionInputs {
  readonly projectPath: string;
  readonly specPath: string;
  readonly neo4jUri: string;
  readonly neo4jPassword: string;
  readonly outputFormat: OutputFormat;
  readonly evaluationMode: EvaluationMode;
  readonly anthropicApiKey?: string;
  readonly openaiApiKey?: string;
  readonly ahsThreshold?: number;
}
```

### ActionOutputs

```typescript
interface ActionOutputs {
  readonly ahsScore: string;          // "0.87"
  readonly verdict: string;            // "pass" | "warning" | "soft-block" | "hard-block"
  readonly reportPath: string;         // path to JSON report artifact
}
```

### PRCommentPayload

```typescript
interface PRCommentPayload {
  readonly marker: '<!-- firewall-report -->';
  readonly ahsScore: number;
  readonly verdict: OverallVerdict;
  readonly dimensionSummary: readonly { dimension: Dimension; avr: number; violations: number }[];
  readonly topViolations: readonly { file: string; rule: string; severity: Severity }[];
  readonly evaluationMode: EvaluationMode;
  readonly durationMs: number;
}
```
