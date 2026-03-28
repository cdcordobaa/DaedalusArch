# Component Methods — Architectural Firewall

Method signatures for each component. Detailed business rules will be defined in Functional Design (Construction Phase).

---

## C1: APG Extractor

```typescript
// Main entry point
extractAPG(projectPath: string, options?: ExtractorOptions): Promise<Result<APGResult, ExtractorError>>

// Internal methods
parseProject(projectPath: string): Promise<ts.Project>
extractNodes(sourceFiles: SourceFile[]): APGNode[]
extractEdges(sourceFiles: SourceFile[], nodes: APGNode[]): APGEdge[]
resolveBarrelImports(importDecl: ImportDeclaration, project: ts.Project): ResolvedImport
resolvePathAliases(importPath: string, tsconfig: TsConfig): string
extractDecorators(classDecl: ClassDeclaration): DecoratorMetadata[]
resolveDITypes(constructorParams: ParameterDeclaration[]): DIResolution[]
computeParseCoverage(total: number, parsed: number, skipped: SkippedFile[]): ParseCoverage
```

**Types**:
```typescript
interface ExtractorOptions {
  lenientMode?: boolean    // default: true
  includeDecorators?: boolean  // default: true
}

interface APGResult {
  nodes: APGNode[]
  edges: APGEdge[]
  parseCoverage: ParseCoverage
  warnings: ExtractorWarning[]
}
```

---

## C2: Neo4j Ingestion

```typescript
// Main entry points
ingestAPG(input: IngestionInput): Promise<Result<IngestionResult, IngestionError>>
computeDeltaAPG(currentAPG: APGResult, previousSnapshot: Snapshot): DeltaAPG
persistSnapshot(apgResult: APGResult, commitSha: string, metadata: SnapshotMetadata): Promise<void>
detectDrift(snapshotA: string, snapshotB: string): Promise<DriftReport>
generateDriftReport(from: string, to: string): Promise<DriftReport>

// Internal methods
clearGraph(session: Neo4jSession): Promise<void>
createNodes(nodes: APGNode[], session: Neo4jSession): Promise<void>
createEdges(edges: APGEdge[], session: Neo4jSession): Promise<void>
annotateLayer(node: APGNode, mappings: LayerMapping[]): LayerAnnotation
applyLayerAnnotations(session: Neo4jSession, mappings: LayerMapping[]): Promise<LayerAnnotationSummary>
computeStructuralDrift(deltaAPG: DeltaAPG): StructuralDriftMetric
computeCouplingDrift(snapshotA: GraphStats, snapshotB: GraphStats): CouplingDriftMetric
computeConventionDrift(snapshotA: ConventionStats, snapshotB: ConventionStats): ConventionDriftMetric
computeViolationTrend(history: AVRScore[]): ViolationTrendMetric
```

**Types**:
```typescript
interface IngestionInput {
  apgResult: APGResult
  layerMappings: LayerMapping[]
  mode: 'stateless' | 'persistent'
  commitSha?: string
}

interface IngestionResult {
  graphStats: GraphStats
  layerAnnotationSummary: LayerAnnotationSummary
  deltaStats?: DeltaStats
  driftReport?: DriftReport
}

interface DriftReport {
  from: string  // commit SHA
  to: string
  structural: StructuralDriftMetric
  coupling: CouplingDriftMetric
  convention: ConventionDriftMetric
  violationTrend: ViolationTrendMetric
  alerts: DriftAlert[]
}
```

---

## C3: Spec Parser

```typescript
// Main entry points
parseSpec(specFilePath: string): Promise<Result<ParsedSpec, SpecParserError>>
parseADRs(adrDirPath: string): Promise<Result<ADRRule[], ADRParserError>>
validateSpec(rawYaml: unknown): ValidationResult

// Internal methods
parseLayerA(raw: unknown): LayerModel
parseLayerB(raw: unknown): FitnessFunction[]
parseLayerC(raw: unknown): ScoringConfig
resolveTemplate(style: string): FitnessFunction[]
validateSemanticCriteria(ff: FitnessFunction): ValidationResult
validateADRRef(adrRef: string): Promise<ValidationResult>
parseMADR(content: string): ADRRule
parseNygard(content: string): ADRRule
parseYStatement(content: string): ADRRule
produceDualRules(adr: ADRRule): { symbolic: CypherRule, semantic: SemanticCriterion }
```

**Types**:
```typescript
interface ParsedSpec {
  spec_version: string   // e.g., "1.0.0"
  layerModel: LayerModel
  fitnessFunctions: FitnessFunction[]
  scoringWeights: ScoringWeights
  confidenceThresholds: ConfidenceThresholds
  adrRules: ADRRule[]
}

interface FitnessFunction {
  id: string
  name: string
  dimension: Dimension
  severity: Severity
  threshold: number
  route: Route
  semanticCriteria?: SemanticCriteria
}

interface SemanticCriteria {
  rule: string
  adrRef?: string
  rubric: { pass: string, fail: string, evidenceRequired: string }
}
```

---

## C4: Fitness Compiler

```typescript
// Main entry point
compileFunctions(input: CompilerInput): Result<CompiledFunctions, CompilerError>

// Internal methods
compileSymbolic(ff: FitnessFunction): CypherQuery
compileNeuronal(ff: FitnessFunction): NeuronalInstruction
compileHybrid(ff: FitnessFunction): HybridPair
instantiateTemplate(template: CypherTemplate, params: Record<string, unknown>): CypherQuery
resolveBuiltInTemplate(functionName: string): CypherTemplate
tagRoute(ff: FitnessFunction): TaggedFunction
```

**Types**:
```typescript
interface CompilerInput {
  fitnessFunctions: FitnessFunction[]
}

interface CompiledFunctions {
  symbolicQueries: TaggedCypherQuery[]
  neuronalInstructions: NeuronalInstruction[]
  hybridPairs: HybridPair[]
}

interface TaggedCypherQuery {
  functionId: string
  dimension: Dimension
  severity: Severity
  threshold: number
  route: 'symbolic'
  cypher: string
  params: Record<string, unknown>
}

interface HybridPair {
  functionId: string
  symbolic: TaggedCypherQuery
  neuronal: NeuronalInstruction
}
```

---

## C5: Neuro-Symbolic Router

```typescript
// Main entry point
routeAndEvaluate(input: RouterInput): Promise<Result<EvaluationResults, RouterError>>

// Internal methods
dispatchSymbolic(queries: TaggedCypherQuery[], engine: EvaluationEngine): Promise<SymbolicResults>
dispatchNeuronal(instructions: NeuronalInstruction[], critic: LLMCriticAgent): Promise<NeuronalResults>
dispatchHybrid(pairs: HybridPair[], engine: EvaluationEngine, critic: LLMCriticAgent): Promise<HybridResults>
applyActivationRules(ff: TaggedFunction): Route
filterByMode(functions: CompiledFunctions, mode: EvaluationMode): CompiledFunctions
tagDeterminism(results: EvaluationResults): EvaluationResults
```

**Types**:
```typescript
interface RouterInput {
  compiledFunctions: CompiledFunctions
  mode: 'full' | 'symbolic-only'
  evaluationEngine: EvaluationEngine
  llmCriticAgent: LLMCriticAgent
}

interface EvaluationResults {
  symbolicResults: SymbolicResult[]
  neuronalResults: NeuronalResult[]
  hybridResults: HybridResult[]
}

type EvaluationMode = 'full' | 'symbolic-only' | 'neuronal-only'
```

---

## C6: Evaluation Engine

```typescript
// Main entry point
evaluateSymbolic(input: SymbolicEvalInput): Promise<Result<SymbolicResults, EvalError>>

// Internal methods
executeQuery(query: TaggedCypherQuery, session: Neo4jSession): Promise<QueryResult>
collectViolations(queryResult: QueryResult, query: TaggedCypherQuery): Violation[]
computePassFail(violations: Violation[], threshold: number): boolean
detectCycles(session: Neo4jSession): Promise<CycleResult[]>
```

**Types**:
```typescript
interface SymbolicEvalInput {
  queries: TaggedCypherQuery[]
  graphRepository: GraphRepository
}

interface SymbolicResult {
  functionId: string
  dimension: Dimension
  pass: boolean
  violations: Violation[]
  executionTimeMs: number
  deterministic: true
}
```

---

## C7: LLM Critic Agent

```typescript
// Main entry point
evaluateNeuronal(input: NeuronalEvalInput): Promise<Result<NeuronalResults, CriticError>>

// Internal methods
assembleContext(instruction: NeuronalInstruction, sourceFiles: Map<string, string>, subgraphs: Map<string, APGSubgraph>, adrFiles?: Map<string, string>): ContextPacket
constructPrompt(context: ContextPacket): string
executeEvaluation(prompt: string, provider: LLMProvider, runs: number): Promise<LLMRunResult[]>
parseVerdict(rawResponse: string): CriticVerdict
computeICC(runs: LLMRunResult[]): number
computeRunStats(runs: LLMRunResult[]): { mean: number, stdDev: number }
flagUnstable(icc: number, threshold: number): boolean
logCall(auditEntry: AuditEntry): void
```

**Types**:
```typescript
interface NeuronalEvalInput {
  instructions: NeuronalInstruction[]
  projectSourceFiles: Map<string, string>
  apgSubgraphs: Map<string, APGSubgraph>
  adrFiles?: Map<string, string>
  provider: LLMProvider
  runsPerEvaluation: number  // default: 3
  vcrMode: 'record' | 'replay' | 'bypass'  // default: 'bypass'
}

interface NeuronalResult {
  functionId: string
  dimension: Dimension
  verdict: CriticVerdict
  confidence: number
  confidenceStdDev: number
  icc: number
  isStable: boolean
  reasoning: string
  evidence: string[]
  violations: Violation[]
  runs: LLMRunResult[]
  auditLog: AuditEntry
  deterministic: false
}

interface CriticVerdict {
  pass: boolean
  confidence: number
  reasoning: string
  evidence: string[]
  violations: Violation[]
}
```

---

## C8: Scoring Engine

```typescript
// Main entry points
computeScores(input: ScoringInput): Result<EvaluationReport, ScoringError>
computeUniversalMetrics(graphRepository: GraphRepository): Promise<UniversalMetrics>
mergeVerdicts(symbolic: SymbolicResult[], neuronal: NeuronalResult[], thresholds: ConfidenceThresholds): MergedVerdict

// Internal methods
computeAVR(results: EvaluationResult[], dimension: Dimension): AVRScore
computeAHS(avrs: Map<Dimension, AVRScore>, weights: ScoringWeights): AHSScore
computeAHSDeterministic(avrs: Map<Dimension, AVRScore>, weights: ScoringWeights): AHSScore
applyConfidenceCalibration(neuronalResult: NeuronalResult, thresholds: ConfidenceThresholds): CalibratedResult
determineVerdict(mergedResults: MergedResult[]): Verdict
generateJSONReport(report: EvaluationReport): string
generateHumanReport(report: EvaluationReport): string
generateCSVRow(report: EvaluationReport): string
```

**Types**:
```typescript
interface ScoringInput {
  evaluationResults: EvaluationResults
  scoringWeights: ScoringWeights
  confidenceThresholds: ConfidenceThresholds
  mode: EvaluationMode
}

interface EvaluationReport {
  projectName: string
  commitSha?: string
  ahsDeterministic: number
  ahsCombined: number
  verdict: Verdict
  perDimensionBreakdown: DimensionBreakdown[]
  violations: Violation[]
  universalMetrics: UniversalMetrics
}

type Verdict = 'hard-block' | 'soft-block' | 'warning' | 'pass'
```

---

## C9: CLI

```typescript
// Main entry point
main(argv: string[]): Promise<void>

// Command handlers
handleEvaluate(options: EvaluateOptions): Promise<void>
handleBatch(options: BatchOptions): Promise<void>
handleDrift(options: DriftOptions): Promise<void>

// Internal methods
buildPipeline(options: CommonOptions): PipelineExecutor
formatOutput(report: EvaluationReport, format: OutputFormat): string
setExitCode(verdict: Verdict): void
```

**Types**:
```typescript
interface EvaluateOptions {
  project: string
  spec: string
  format: 'json' | 'human' | 'csv'
  verbose: boolean
  neo4jUri: string
  symbolicOnly: boolean
  neuronalOnly: boolean
  mode: 'stateless' | 'persistent'
}
```

---

## C10: Shared Domain — Key Interfaces

```typescript
// Pipeline interfaces
interface PipelineStage<TInput, TOutput> {
  execute(input: TInput): Promise<Result<TOutput, PipelineError>>
}

interface PipelineCommand {
  name: string
  execute(): Promise<Result<unknown, PipelineError>>
  canExecute(): boolean
}

// Repository interface (DDD)
interface GraphRepository {
  getSession(): Promise<Neo4jSession>
  releaseSession(session: Neo4jSession): void
  executeQuery(cypher: string, params?: Record<string, unknown>): Promise<QueryResult>
  clearGraph(): Promise<void>
  close(): Promise<void>
}

// LLM Provider interface (Strategy pattern)
interface LLMProvider {
  name: string
  evaluate(prompt: string, options: LLMOptions): Promise<LLMResponse>
}

interface LLMProviderFactory {
  create(config: LLMConfig): LLMProvider
}

// Snapshot Store interface
interface SnapshotStore {
  saveSnapshot(commitSha: string, apg: APGResult, metadata: SnapshotMetadata): Promise<void>
  loadSnapshot(commitSha: string): Promise<Snapshot | null>
  saveDelta(fromSha: string, toSha: string, delta: DeltaAPG): Promise<void>
  saveDriftReport(commitSha: string, report: DriftReport): Promise<void>
  listSnapshots(): Promise<SnapshotSummary[]>
}

// Result type for error propagation
type Result<T, E> = { ok: true, value: T } | { ok: false, error: E }

// Base error types
interface PipelineError {
  stage: string
  severity: 'critical' | 'warning'
  message: string
  cause?: Error
}
```
