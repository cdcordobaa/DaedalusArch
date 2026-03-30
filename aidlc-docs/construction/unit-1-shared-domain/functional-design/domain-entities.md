# Domain Entities — Unit 1: Shared Domain

## C10: Core Enumerations

```typescript
// src/shared/types/enums.ts

export type NodeType =
  | 'File'
  | 'Class'
  | 'Interface'
  | 'Method'
  | 'Function';

export type EdgeType =
  | 'IMPORTS'
  | 'IMPLEMENTS'
  | 'EXTENDS'
  | 'CONSTRUCTOR_INJECTS'
  | 'CALLS'
  | 'DECLARES'
  | 'CONTAINS';

export type Dimension =
  | 'structural'
  | 'coupling'
  | 'pattern'
  | 'solid'
  | 'convention'
  | 'semantic'
  | 'intent';

export type Severity = 'critical' | 'major' | 'minor' | 'advisory';

export type Route = 'symbolic' | 'neuronal' | 'hybrid';

export type EvaluationMode = 'full' | 'symbolic-only' | 'neuronal-only';

export type PipelineMode = 'stateless' | 'persistent';

export type OverallVerdict = 'pass' | 'warning' | 'soft-block' | 'hard-block';

export type ADRFormat = 'MADR' | 'Nygard' | 'Y-Statement' | 'custom-yaml';
```

---

## C10: Value Objects (Branded Types)

```typescript
// src/shared/types/value-objects.ts

// Branding helper
declare const _brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [_brand]: B };

// Numeric scores — all constrained to [0.0, 1.0]
export type AVRScore = Brand<number, 'AVRScore'>;       // Architectural Violation Rate per dimension
export type AHSScore = Brand<number, 'AHSScore'>;       // Architectural Health Score (weighted complement)
export type Confidence = Brand<number, 'Confidence'>;   // LLM evaluation confidence

// String value objects
export type CommitSha = Brand<string, 'CommitSha'>;     // 40-char hex SHA
export type FunctionId = Brand<string, 'FunctionId'>;   // e.g. "FF-S01"
export type RunId = Brand<string, 'RunId'>;             // UUID for a pipeline run

// Smart constructors (enforce invariants)
export function avrScore(n: number): AVRScore {
  if (n < 0 || n > 1) throw new RangeError(`AVRScore must be [0,1], got ${n}`);
  return n as AVRScore;
}

export function ahsScore(n: number): AHSScore {
  if (n < 0 || n > 1) throw new RangeError(`AHSScore must be [0,1], got ${n}`);
  return n as AHSScore;
}

export function confidence(n: number): Confidence {
  if (n < 0 || n > 1) throw new RangeError(`Confidence must be [0,1], got ${n}`);
  return n as Confidence;
}

export function commitSha(s: string): CommitSha {
  if (!/^[0-9a-f]{40}$/i.test(s)) throw new TypeError(`Invalid commit SHA: ${s}`);
  return s as CommitSha;
}
```

---

## C10: APG Domain Types

```typescript
// src/shared/types/apg.ts

export interface APGNode {
  readonly id: string;              // Unique within the APG (e.g. filePath + ':' + name)
  readonly type: NodeType;
  readonly filePath: string;        // Absolute path
  readonly name: string;            // Class/function/file name
  layer?: string;                   // Set by Neo4j Ingestion (C2) from layer annotations
  role?: string;                    // e.g. 'presentation' | 'application' | 'domain' | 'infrastructure'
  readonly decorators: readonly string[]; // TypeScript decorator names
  readonly properties: Readonly<Record<string, unknown>>; // Additional metadata
}

export interface APGEdge {
  readonly id: string;
  readonly type: EdgeType;
  readonly sourceId: string;        // APGNode.id
  readonly targetId: string;        // APGNode.id
  readonly properties: Readonly<Record<string, unknown>>;
}

export interface APGResult {
  readonly nodes: readonly APGNode[];
  readonly edges: readonly APGEdge[];
  readonly parseCoverage: ParseCoverage;
  readonly warnings: readonly ExtractorWarning[];
}

export interface ParseCoverage {
  readonly total: number;           // Total source files found
  readonly parsed: number;          // Files successfully parsed
  readonly percentage: number;      // parsed / total * 100
  readonly skipped: readonly SkippedFile[];
}

export interface SkippedFile {
  readonly filePath: string;
  readonly reason: string;
}

export interface ExtractorWarning {
  readonly filePath: string;
  readonly message: string;
  readonly code: string;
}
```

---

## C10: Fitness Function Types

```typescript
// src/shared/types/spec.ts

export interface FitnessFunction {
  readonly id: FunctionId;          // e.g. 'FF-S01'
  readonly name: string;            // e.g. 'no-layer-skip'
  readonly dimension: Dimension;
  readonly severity: Severity;
  readonly threshold: number;       // Pass threshold (semantics vary by function)
  readonly route: Route;
  readonly semanticCriteria?: SemanticCriteria; // Required for neuronal/hybrid
  readonly isBuiltIn: boolean;      // True if from clean-architecture template
}

export interface SemanticCriteria {
  readonly rule: string;            // Human-readable rule statement
  readonly adrRef?: string;         // Optional ADR reference (e.g. 'ADR-003')
  readonly rubric: EvalRubric;
}

export interface EvalRubric {
  readonly pass: string;            // What constitutes a pass
  readonly fail: string;            // What constitutes a fail
  readonly evidenceRequired: string; // What evidence the LLM must cite
}

export interface LayerModel {
  readonly layers: readonly LayerDefinition[];
}

export interface LayerDefinition {
  readonly name: string;
  readonly directories: readonly string[];
  readonly naming: readonly string[];  // Glob patterns
  readonly decorators?: readonly string[];
  readonly role: string;
}

export interface ScoringWeights {
  readonly structural: number;
  readonly coupling: number;
  readonly pattern: number;
  readonly solid: number;
  readonly convention: number;
  // semantic + intent are 0 in symbolic-only mode; non-zero in full mode
  readonly semantic: number;
  readonly intent: number;
}
// Spike-validated defaults for symbolic-only mode (sum to 1.0):
// { structural:0.35, coupling:0.20, pattern:0.30, solid:0.10, convention:0.05, semantic:0, intent:0 }

export interface ConfidenceThresholds {
  readonly high: number;            // >= 0.85 → high confidence
  readonly medium: number;          // >= 0.60 → medium confidence
  readonly iccMinimum: number;      // < 0.70 → flag as unstable
}

export interface ParsedSpec {
  readonly specVersion: string;
  readonly layerModel: LayerModel;
  readonly fitnessFunctions: readonly FitnessFunction[];
  readonly scoringWeights: ScoringWeights;
  readonly confidenceThresholds: ConfidenceThresholds;
  readonly adrRules: readonly ADRRule[];
}

export interface ADRRule {
  readonly id: string;
  readonly title: string;
  readonly format: ADRFormat;
  readonly symbolicRule?: CypherRule;
  readonly semanticCriterion?: SemanticCriteria;
  readonly rawContent: string;
}

export interface CypherRule {
  readonly query: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly description: string;
}
```

---

## C10: Violation Types

```typescript
// src/shared/taxonomy/violation-types.ts

export const BUILT_IN_VIOLATION_TYPES = [
  'LAYER_VIOLATION',         // structural: dependency crosses layer boundaries in wrong direction
  'CYCLIC_DEPENDENCY',       // structural: circular dependency detected
  'FAN_OUT_EXCEEDED',        // coupling: too many outgoing dependencies
  'INSTABILITY_VIOLATION',   // coupling: module instability exceeds threshold
  'PATTERN_MISMATCH',        // pattern: class doesn't match its declared pattern role
  'MISSING_PATTERN_ELEMENT', // pattern: required element of a pattern is absent
  'SRP_VIOLATION',           // SOLID: Single Responsibility Principle violation
  'DIP_VIOLATION',           // SOLID: Dependency Inversion Principle violation
  'NAMING_CONVENTION',       // convention: file/class doesn't match naming convention
  'PLACEMENT_CONVENTION',    // convention: file placed in wrong directory
  'SEMANTIC_RULE_VIOLATION', // semantic: LLM-detected semantic rule violation
  'INTENT_VIOLATION',        // intent: LLM-detected intent/ADR violation
] as const;

export type BuiltInViolationType = typeof BUILT_IN_VIOLATION_TYPES[number];

// Custom types registered via AoC YAML extension
export type ViolationType = BuiltInViolationType | `CUSTOM_${string}`;

export interface Violation {
  readonly id: string;              // UUID
  readonly type: ViolationType;
  readonly dimension: Dimension;
  readonly severity: Severity;
  readonly functionId: FunctionId;  // Which fitness function detected it
  readonly route: Route;            // symbolic | neuronal | hybrid
  readonly filePath: string;        // Violating file
  readonly sourceLayer?: string;    // For layer violations
  readonly targetLayer?: string;    // For layer violations
  readonly message: string;         // Human-readable description
  readonly evidence?: readonly string[]; // LLM evidence snippets (neuronal only)
  readonly deterministic: boolean;  // false for neuronal results
}
```

---

## C10: Result Types and Error Handling

```typescript
// src/shared/errors/domain-result.ts

export interface DomainError {
  readonly code: string;
  readonly message: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface DomainWarning {
  readonly code: string;
  readonly message: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export type DomainResult<T> =
  | { readonly success: true; readonly data: T; readonly warnings?: readonly DomainWarning[] }
  | { readonly success: false; readonly errors: readonly DomainError[]; readonly warnings?: readonly DomainWarning[] };

// Helper constructors
export const DomainResult = {
  ok<T>(data: T, warnings?: readonly DomainWarning[]): DomainResult<T> {
    return { success: true, data, ...(warnings ? { warnings } : {}) };
  },
  fail<T>(errors: readonly DomainError[], warnings?: readonly DomainWarning[]): DomainResult<T> {
    if (errors.length === 0) throw new Error('DomainResult.fail requires at least one error');
    return { success: false, errors, ...(warnings ? { warnings } : {}) };
  },
  fromError<T>(error: unknown): DomainResult<T> {
    const message = error instanceof Error ? error.message : String(error);
    return DomainResult.fail([{ code: 'UNEXPECTED_ERROR', message }]);
  },
} as const;

// Pipeline-specific error types
export interface PipelineError extends DomainError {
  readonly stage: string;
  readonly critical: boolean;  // true = stop pipeline, false = accumulate as warning
}

export interface PipelineWarning extends DomainWarning {
  readonly stage: string;
}

export interface PipelineAuditEntry {
  readonly timestamp: string;  // ISO 8601
  readonly stage: string;
  readonly event: string;
  readonly durationMs?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
```

---

## C10: Repository and Service Interfaces

```typescript
// src/shared/interfaces/graph-repository.ts
export interface GraphRepository {
  executeQuery(cypher: string, params?: Record<string, unknown>): Promise<DomainResult<QueryResult>>;
  clearGraph(): Promise<DomainResult<void>>;
  healthCheck(): Promise<boolean>;
  close(): Promise<void>;
}

export interface QueryResult {
  readonly records: readonly Record<string, unknown>[];
  readonly summary: { readonly counters: Record<string, number> };
}

// src/shared/interfaces/llm-provider.ts
export interface LLMProvider {
  readonly name: string;
  evaluate(prompt: string, options: LLMOptions): Promise<DomainResult<LLMResponse>>;
}

export interface LLMOptions {
  readonly temperature: 0;
  readonly seed?: number;
  readonly maxTokens?: number;
}

export interface LLMResponse {
  readonly content: string;
  readonly model: string;
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
}

// src/shared/interfaces/snapshot-store.ts
export interface SnapshotStore {
  saveSnapshot(commitSha: CommitSha, apg: APGResult, metadata: SnapshotMetadata): Promise<DomainResult<void>>;
  loadSnapshot(commitSha: CommitSha): Promise<DomainResult<Snapshot | null>>;
  listSnapshots(): Promise<DomainResult<readonly SnapshotSummary[]>>;
  getLatestSnapshot(): Promise<DomainResult<Snapshot | null>>;
}

export interface SnapshotMetadata {
  readonly commitSha: CommitSha;
  readonly timestamp: string;
  readonly projectPath: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
}

export interface Snapshot {
  readonly metadata: SnapshotMetadata;
  readonly apg: APGResult;
}

export interface SnapshotSummary {
  readonly commitSha: CommitSha;
  readonly timestamp: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
}

// src/shared/interfaces/pipeline-stage.ts
export interface PipelineStage<TInput, TOutput> {
  readonly name: string;
  execute(input: TInput, context: FirewallContext): Promise<DomainResult<TOutput>>;
}

export interface PipelineCommand {
  readonly name: string;
  execute(context: FirewallContext): Promise<DomainResult<void>>;
}
```

---

## C11: FirewallContext Aggregate Root

```typescript
// src/shared/context/firewall-context.ts

export interface FirewallContextSnapshot {
  readonly runId: RunId;
  readonly startedAt: string;
  readonly apgResult?: APGResult;
  readonly parsedSpec?: ParsedSpec;
  readonly ingestionResult?: IngestionResult;
  readonly compiledFunctions?: CompiledFunctions;
  readonly evaluationResults?: EvaluationResults;
  readonly report?: EvaluationReport;
  readonly warnings: readonly PipelineWarning[];
  readonly auditLog: readonly PipelineAuditEntry[];
}

export class FirewallContext {
  private readonly _runId: RunId;
  private readonly _startedAt: string;
  private _apgResult?: APGResult;
  private _parsedSpec?: ParsedSpec;
  private _ingestionResult?: IngestionResult;
  private _compiledFunctions?: CompiledFunctions;
  private _evaluationResults?: EvaluationResults;
  private _report?: EvaluationReport;
  private readonly _warnings: PipelineWarning[];
  private readonly _auditLog: PipelineAuditEntry[];

  constructor(runId: RunId) {
    this._runId = runId;
    this._startedAt = new Date().toISOString();
    this._warnings = [];
    this._auditLog = [];
  }

  // --- Typed Setters (enforce "set-once" invariant — cannot overwrite) ---

  setApgResult(result: APGResult): void {
    if (this._apgResult !== undefined) {
      throw new Error('APGResult already set on FirewallContext — cannot overwrite');
    }
    this._apgResult = result;
  }

  setParsedSpec(spec: ParsedSpec): void {
    if (this._parsedSpec !== undefined) {
      throw new Error('ParsedSpec already set on FirewallContext — cannot overwrite');
    }
    this._parsedSpec = spec;
  }

  setIngestionResult(result: IngestionResult): void {
    if (this._ingestionResult !== undefined) {
      throw new Error('IngestionResult already set on FirewallContext — cannot overwrite');
    }
    this._ingestionResult = result;
  }

  setCompiledFunctions(functions: CompiledFunctions): void {
    if (this._compiledFunctions !== undefined) {
      throw new Error('CompiledFunctions already set on FirewallContext — cannot overwrite');
    }
    this._compiledFunctions = functions;
  }

  setEvaluationResults(results: EvaluationResults): void {
    if (this._evaluationResults !== undefined) {
      throw new Error('EvaluationResults already set on FirewallContext — cannot overwrite');
    }
    this._evaluationResults = results;
  }

  setReport(report: EvaluationReport): void {
    if (this._report !== undefined) {
      throw new Error('EvaluationReport already set on FirewallContext — cannot overwrite');
    }
    this._report = report;
  }

  // --- Typed Getters (throw if stage prerequisite not met) ---

  get runId(): RunId { return this._runId; }
  get startedAt(): string { return this._startedAt; }
  get warnings(): readonly PipelineWarning[] { return this._warnings; }
  get auditLog(): readonly PipelineAuditEntry[] { return this._auditLog; }

  getApgResult(): APGResult {
    if (this._apgResult === undefined) throw new Error('APGResult not available — run APG Extractor first');
    return this._apgResult;
  }

  getParsedSpec(): ParsedSpec {
    if (this._parsedSpec === undefined) throw new Error('ParsedSpec not available — run Spec Parser first');
    return this._parsedSpec;
  }

  getIngestionResult(): IngestionResult {
    if (this._ingestionResult === undefined) throw new Error('IngestionResult not available — run Neo4j Ingestion first');
    return this._ingestionResult;
  }

  getCompiledFunctions(): CompiledFunctions {
    if (this._compiledFunctions === undefined) throw new Error('CompiledFunctions not available — run Fitness Compiler first');
    return this._compiledFunctions;
  }

  getEvaluationResults(): EvaluationResults {
    if (this._evaluationResults === undefined) throw new Error('EvaluationResults not available — run Router first');
    return this._evaluationResults;
  }

  getReport(): EvaluationReport {
    if (this._report === undefined) throw new Error('EvaluationReport not available — run Scoring Engine first');
    return this._report;
  }

  // --- Mutation Methods (accumulate-only, never remove) ---

  addWarning(warning: PipelineWarning): void {
    this._warnings.push(warning);
  }

  addAuditEntry(entry: PipelineAuditEntry): void {
    this._auditLog.push(entry);
  }

  // --- Snapshot (read-only projection of current state) ---

  snapshot(): FirewallContextSnapshot {
    return {
      runId: this._runId,
      startedAt: this._startedAt,
      apgResult: this._apgResult,
      parsedSpec: this._parsedSpec,
      ingestionResult: this._ingestionResult,
      compiledFunctions: this._compiledFunctions,
      evaluationResults: this._evaluationResults,
      report: this._report,
      warnings: [...this._warnings],
      auditLog: [...this._auditLog],
    };
  }
}
```

---

## C10: Evaluation Result Types (Contracts between Units)

```typescript
// src/shared/types/evaluation.ts

// Inputs/outputs for downstream units — defined here as contracts

export interface IngestionResult {
  readonly graphStats: GraphStats;
  readonly layerAnnotationSummary: LayerAnnotationSummary;
  readonly deltaStats?: DeltaStats;
}

export interface GraphStats {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly layerCoverage: number; // % of nodes with layer annotation
}

export interface LayerAnnotationSummary {
  readonly mapped: number;
  readonly unmapped: number;
  readonly unmappedFiles: readonly string[];
}

export interface DeltaStats {
  readonly addedNodes: number;
  readonly removedNodes: number;
  readonly addedEdges: number;
  readonly removedEdges: number;
}

export interface CompiledFunctions {
  readonly symbolicQueries: readonly CypherQuery[];
  readonly neuronalInstructions: readonly NeuronalInstruction[];
  readonly hybridPairs: readonly HybridPair[];
}

export interface CypherQuery {
  readonly functionId: FunctionId;
  readonly cypher: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly dimension: Dimension;
  readonly severity: Severity;
  readonly threshold: number;
}

export interface NeuronalInstruction {
  readonly functionId: FunctionId;
  readonly dimension: Dimension;
  readonly severity: Severity;
  readonly semanticCriteria: SemanticCriteria;
  readonly contextAssemblyHints: readonly string[];
}

export interface HybridPair {
  readonly functionId: FunctionId;
  readonly symbolicQuery: CypherQuery;
  readonly neuronalInstruction: NeuronalInstruction;
}

export interface SymbolicFunctionResult {
  readonly functionId: FunctionId;
  readonly passed: boolean;
  readonly violations: readonly Violation[];
  readonly executionTimeMs: number;
  readonly deterministic: true;
}

export interface NeuronalFunctionResult {
  readonly functionId: FunctionId;
  readonly verdict: 'pass' | 'fail' | 'warning';
  readonly confidence: Confidence;
  readonly confidenceStdDev: number;
  readonly icc: number;             // Intraclass Correlation Coefficient
  readonly reasoning: string;
  readonly evidence: readonly string[];
  readonly violations: readonly Violation[];
  readonly runs: readonly NeuronalRun[];
  readonly deterministic: false;
  readonly flaggedUnstable: boolean; // ICC < threshold
}

export interface NeuronalRun {
  readonly runIndex: number;
  readonly verdict: 'pass' | 'fail' | 'warning';
  readonly confidence: Confidence;
  readonly reasoning: string;
}

export interface EvaluationResults {
  readonly symbolicResults: readonly SymbolicFunctionResult[];
  readonly neuronalResults: readonly NeuronalFunctionResult[];
}

export interface PerDimensionScore {
  readonly dimension: Dimension;
  readonly avr: AVRScore;
  readonly weight: number;
  readonly violationCount: number;
  readonly functionCount: number;
}

export interface UniversalHealthMetrics {
  readonly cyclicDependencyCount: number;
  readonly maxFanOut: number;
  readonly maxFanIn: number;
  readonly abstractionRatio: number;   // interfaces+abstracts / total classes
  readonly averageInstability: number; // fan-out / (fan-in + fan-out)
  readonly orphanFileCount: number;
}

export interface EvaluationReport {
  readonly runId: RunId;
  readonly projectPath: string;
  readonly specVersion: string;
  readonly ahsDeterministic: AHSScore;   // Symbolic-only AHS
  readonly ahsCombined?: AHSScore;       // Combined neuronal+symbolic AHS
  readonly ahsNeuronal?: AHSScore;       // Neuronal-only AHS
  readonly verdict: OverallVerdict;
  readonly perDimensionScores: readonly PerDimensionScore[];
  readonly violations: readonly Violation[];
  readonly universalMetrics: UniversalHealthMetrics;
  readonly evaluationMode: EvaluationMode;
  readonly durationMs: number;
  readonly warnings: readonly PipelineWarning[];
}
```
