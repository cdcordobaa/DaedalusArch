# Service Definitions — Architectural Firewall

## Orchestration Pattern

**Command Pattern** (Q2: C) — each pipeline stage is a Command object. A PipelineExecutor runs commands in sequence with support for parallel/branching execution (the Router dispatches symbolic and neuronal paths concurrently).

---

## S1: PipelineExecutor

**Purpose**: Central orchestrator that builds and executes the evaluation pipeline as a sequence of Command objects.

**Responsibilities**:
- Build the command sequence based on evaluation mode (stateless/persistent, symbolic-only/full)
- Execute commands in order, passing typed outputs as inputs to the next stage
- Handle branching at the Router stage (symbolic and neuronal paths run concurrently)
- Collect warnings from all stages (fail-fast for critical, accumulate warnings)
- Provide pipeline-level logging and timing

```typescript
class PipelineExecutor {
  private commands: PipelineCommand[]
  private context: PipelineContext
  private warnings: PipelineWarning[]

  constructor(config: PipelineConfig) {}

  addCommand(command: PipelineCommand): void
  execute(): Promise<Result<EvaluationReport, PipelineError>>
  getWarnings(): PipelineWarning[]
  getTimings(): StageTimings
}

interface PipelineConfig {
  projectPath: string
  specFilePath: string
  neo4jUri: string
  mode: 'stateless' | 'persistent'
  evaluationMode: 'full' | 'symbolic-only' | 'neuronal-only'
  commitSha?: string
  llmConfig?: LLMConfig
}

interface PipelineContext {
  // Shared mutable state that commands read/write
  apgResult?: APGResult
  parsedSpec?: ParsedSpec
  ingestionResult?: IngestionResult
  compiledFunctions?: CompiledFunctions
  evaluationResults?: EvaluationResults
  report?: EvaluationReport
  warnings: PipelineWarning[]
}
```

**Error Handling** (Q6: C):
- **Critical errors** (Neo4j connection failure, spec validation failure, extraction failure): pipeline stops immediately, returns `Result.error` with the critical error
- **Warnings** (file parse skip, ADR ref not found, unstable ICC): accumulated in `PipelineContext.warnings`, included in final report

---

## S2: GraphRepositoryService

**Purpose**: Manages Neo4j connection pool and provides a repository interface for all graph operations (DDD pattern, Q3: A).

**Responsibilities**:
- Maintain a connection pool to Neo4j
- Provide session checkout/release for transactional operations
- Expose query execution with automatic session management
- Handle connection lifecycle (init, health check, graceful shutdown)

```typescript
class GraphRepositoryService implements GraphRepository {
  private pool: Neo4jConnectionPool

  constructor(config: Neo4jConfig) {}

  async getSession(): Promise<Neo4jSession>
  releaseSession(session: Neo4jSession): void
  async executeQuery(cypher: string, params?: Record<string, unknown>): Promise<QueryResult>
  async clearGraph(): Promise<void>
  async healthCheck(): Promise<boolean>
  async close(): Promise<void>
}

interface Neo4jConfig {
  uri: string           // bolt://localhost:7687
  username: string      // default: neo4j
  password: string      // from env var
  maxPoolSize: number   // default: 10
  connectionTimeout: number  // default: 5000ms
}
```

---

## S3: SnapshotService

**Purpose**: Manages APG snapshot persistence using Neo4j for graph data and filesystem for metadata/drift reports (Q4: B).

**Responsibilities**:
- Save full APG snapshots to Neo4j (labeled by commit SHA) and metadata to filesystem
- Load snapshots for delta computation
- Compute and persist delta APGs between commits
- Store drift reports as JSON files
- Manage APG_Store directory structure

```typescript
class SnapshotService implements SnapshotStore {
  private graphRepository: GraphRepository
  private storePath: string  // APG_Store/ directory

  constructor(graphRepository: GraphRepository, storePath: string) {}

  async saveSnapshot(commitSha: string, apg: APGResult, metadata: SnapshotMetadata): Promise<void>
  async loadSnapshot(commitSha: string): Promise<Snapshot | null>
  async saveDelta(fromSha: string, toSha: string, delta: DeltaAPG): Promise<void>
  async saveDriftReport(commitSha: string, report: DriftReport): Promise<void>
  async listSnapshots(): Promise<SnapshotSummary[]>
  async getLatestSnapshot(): Promise<Snapshot | null>
}
```

**Storage split**:
- **Neo4j**: Graph nodes/edges labeled with commit SHA (queryable historical aggregates)
- **Filesystem**: `APG_Store/snapshot_{sha}/metadata.json`, `APG_Store/delta_{sha_old}_{sha_new}/`, `APG_Store/drift_report_{sha}.json`

---

## S4: LLMProviderService

**Purpose**: Factory + strategy for LLM provider selection and lifecycle management (Q5: B).

**Responsibilities**:
- Create the appropriate LLM provider adapter based on configuration
- Provide common retry/timeout logic in the base strategy
- Manage API key configuration (from environment variables)
- Enforce determinism controls (temperature=0, fixed seed)
- **Concurrency Governor**: Implementation of `p-limit` or similar to throttle simultaneous LLM calls based on `maxConcurrentLLMCalls`.
- **Retry Logic**: Automatic exponential backoff for 429 and 5xx errors.

```typescript
class LLMProviderFactory {
  static create(config: LLMConfig): LLMProvider {
    switch (config.provider) {
      case 'claude': return new ClaudeProvider(config)
      case 'openai': return new OpenAIProvider(config)
      default: throw new ConfigError(`Unknown LLM provider: ${config.provider}`)
    }
  }
}

abstract class BaseLLMProvider implements LLMProvider {
  abstract name: string
  protected config: LLMConfig
  protected retryPolicy: RetryPolicy

  async evaluate(prompt: string, options: LLMOptions): Promise<LLMResponse> {
    // Common retry/timeout logic
    // Subclasses implement the actual API call
  }

  protected abstract callAPI(prompt: string, options: LLMOptions): Promise<LLMResponse>
}

class ClaudeProvider extends BaseLLMProvider { /* ... */ }
class OpenAIProvider extends BaseLLMProvider { /* ... */ }

interface LLMConfig {
  provider: 'claude' | 'openai'
  apiKey: string          // from env var
  model: string           // e.g., 'claude-sonnet-4-6'
  temperature: 0          // enforced
  seed?: number           // fixed for reproducibility
  maxRetries: number      // default: 3
  timeoutMs: number       // default: 30000
}
```

---

## S5: AuditLogService

**Purpose**: Centralized logging for LLM Critic calls and pipeline events.

**Responsibilities**:
- Log every LLM Critic call with input context, prompt, and response
- Log pipeline stage start/end with timing
- **VCR Mode Support**: Read/Write to "cassette" files for deterministic replaying of stochastic AI runs during testing.
- Store audit logs in a reviewable format (JSON lines)

```typescript
class AuditLogService {
  private logPath: string

  constructor(logPath: string) {}

  logLLMCall(entry: LLMAuditEntry): void
  logPipelineEvent(event: PipelineEvent): void
  flush(): Promise<void>
}

interface LLMAuditEntry {
  timestamp: string
  functionId: string
  runIndex: number
  contextPacket: ContextPacket
  prompt: string
  rawResponse: string
  parsedVerdict: CriticVerdict
  executionTimeMs: number
}
```

---

## S6: ReportService

**Purpose**: Generates structured output in multiple formats.

**Responsibilities**:
- Generate JSON report for programmatic consumption
- Generate human-readable summary for CLI and PR comments
- Generate CSV rows for batch evaluation
- Format PR comments (markdown) for GitHub Action integration

```typescript
class ReportService {
  generateJSON(report: EvaluationReport): string
  generateHuman(report: EvaluationReport): string
  generateCSVRow(report: EvaluationReport): string
  generatePRComment(report: EvaluationReport): string
}
```

---

## Service Interaction Summary

```
CLI (C9)
  |
  v
PipelineExecutor (S1)
  |
  +-- [Command: Extract]   --> APG Extractor (C1)
  |
  +-- [Command: ParseSpec]  --> Spec Parser (C3)         [parallel with Extract]
  |
  +-- [Command: Ingest]     --> Neo4j Ingestion (C2)     [uses GraphRepositoryService S2]
  |                              +-- SnapshotService (S3) [if persistent mode]
  |
  +-- [Command: Compile]    --> Fitness Compiler (C4)
  |
  +-- [Command: Route+Eval] --> Neuro-Symbolic Router (C5)
  |                              +-- Evaluation Engine (C6)   [symbolic path, uses S2]
  |                              +-- LLM Critic Agent (C7)    [neuronal path, uses S4 + S5]
  |
  +-- [Command: Score]      --> Scoring Engine (C8)       [uses S2 for universal metrics]
  |
  +-- [Command: Report]     --> ReportService (S6)
```
