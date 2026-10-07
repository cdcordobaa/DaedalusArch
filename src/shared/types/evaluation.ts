import type {
  Dimension, Severity, EvaluationMode, NodeType, EdgeType, Route, TemplateTag, JudgeUnitKind,
} from './enums.js';
import type { DriftReport } from './drift.js';
import type { AVRScore, AHSScore, Confidence, FunctionId, RunId } from './value-objects.js';
import type { SemanticCriteria, CypherRule } from './spec.js';
import type { Violation } from '../taxonomy/violation-types.js';
import type { DomainWarning, PipelineWarning } from '../errors/domain-result.js';
import type { ParseCoverage, ImportResolutionStats } from './apg.js';
import type { LLMEffort } from '../interfaces/llm-provider.js';
import type { VCRMode } from './llm-config.js';

export interface IngestionResult {
  readonly graphStats: GraphStats;
  readonly layerAnnotationSummary: LayerAnnotationSummary;
  readonly deltaStats?: DeltaStats;
  readonly driftReport?: DriftReport;
}

export interface GraphStats {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly layerCoverage: number;
  readonly nodeCountByType: Readonly<Partial<Record<NodeType, number>>>;   // FR-14
  readonly edgeCountByType: Readonly<Partial<Record<EdgeType, number>>>;   // FR-14
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

export interface CypherQuery {
  readonly functionId: FunctionId;
  readonly name: string;
  readonly cypher: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly dimension: Dimension;
  readonly severity: Severity;
  readonly threshold?: number;
  readonly route: 'symbolic' | 'hybrid';
  readonly source: 'template' | 'adr';
}

export interface ContextAssemblyInstruction {
  readonly includeAPGSubgraph: boolean;
  readonly nodeFilter?: string;
  readonly maxNodes?: number;
  readonly includeSourceCode: boolean;
  readonly sourceCodeFilter?: string;
}

export interface NeuronalInstruction {
  readonly functionId: FunctionId;
  readonly name: string;
  readonly dimension: Dimension;
  readonly severity: Severity;
  readonly route: 'neuronal' | 'hybrid';
  readonly semanticCriteria: SemanticCriteria;
  readonly contextAssembly: ContextAssemblyInstruction;
  readonly shadowModeEligible: boolean;
  readonly shadowPrompt?: string;
  readonly source: 'fitness-function' | 'adr';
  readonly judgeUnit: JudgeUnitKind;     // FR-33
}

export interface HybridPair {
  readonly functionId: FunctionId;
  readonly symbolicQuery: CypherQuery;
  readonly neuronalInstruction: NeuronalInstruction;
}

export interface CompiledFunctions {
  readonly symbolicQueries: readonly CypherQuery[];
  readonly neuronalInstructions: readonly NeuronalInstruction[];
  readonly hybridPairs: readonly HybridPair[];
  readonly totalCompiled: number;
  readonly disabledFunctions: readonly import('./spec.js').DisabledFunction[];
  readonly warnings: readonly DomainWarning[];
}

export interface SymbolicFunctionResult {
  readonly functionId: FunctionId;
  readonly dimension: import('./enums.js').Dimension;
  readonly passed: boolean;
  readonly violations: readonly Violation[];
  readonly executionTimeMs: number;
  readonly deterministic: true;
  readonly tag?: TemplateTag;            // FR-29
}

export interface NeuronalRun {
  readonly runIndex: number;
  readonly verdict: 'pass' | 'fail' | 'warning';
  readonly confidence: Confidence;
  readonly reasoning: string;
}

// One judged unit (FR-33)
export interface JudgeUnitResult {
  readonly unitId: string;               // file path, `Class@file`, or module directory
  readonly unitKind: JudgeUnitKind;
  readonly verdict: 'pass' | 'fail' | 'warning';
  readonly confidence: Confidence;
  readonly confidenceStdDev: number;
  readonly runs: readonly NeuronalRun[];
  readonly violations: readonly Violation[];
}

export interface NeuronalFunctionResult {
  readonly functionId: FunctionId;
  readonly dimension: Dimension;                       // FR-32
  readonly verdict: 'pass' | 'fail' | 'warning';
  readonly confidence: Confidence;
  readonly confidenceStdDev: number;
  readonly icc: number;
  readonly reasoning: string;
  readonly evidence: readonly string[];
  readonly violations: readonly Violation[];
  readonly runs: readonly NeuronalRun[];
  readonly deterministic: false;
  readonly flaggedUnstable: boolean;
  readonly unitResults: readonly JudgeUnitResult[];    // FR-33
  readonly unitsSelected: number;                      // FR-33
  readonly unitsCapped: number;                        // FR-33: units dropped by the per-run cap
}

export interface EvaluationResults {
  readonly symbolicResults: readonly SymbolicFunctionResult[];
  readonly neuronalResults: readonly NeuronalFunctionResult[];
}

export interface PerDimensionScore {
  readonly dimension: Dimension;
  readonly avr: AVRScore;
  readonly weight: number;
  readonly effectiveWeight?: number;     // FR-15; optional until U3 freezes the report (D-U0-2)
  readonly violationCount: number;
  readonly functionCount: number;
}

export interface UniversalHealthMetrics {
  readonly cyclicDependencyCount: number;
  readonly maxFanOut: number;
  readonly maxFanIn: number;
  readonly abstractionRatio: number;
  readonly averageInstability: number;
  readonly orphanFileCount: number;
}

// FR-13
export interface FunctionFailure {
  readonly functionId: FunctionId;
  readonly name: string;
  readonly code: string;                 // e.g. 'EVAL_001', 'CRITIC_001'
  readonly message: string;              // scrubbed (NFR-05)
}

export interface FunctionExecution {
  readonly compiled: number;
  readonly executed: number;
  readonly failed: readonly FunctionFailure[];
}

// FR-14
export interface FunctionResultRow {
  readonly functionId: FunctionId;
  readonly name: string;
  readonly dimension: Dimension;
  readonly route: Route;
  readonly tag?: TemplateTag;            // FR-29
  readonly passed: boolean;
  readonly violationCount: number;
  readonly executionTimeMs: number;
}

// FR-15
export type DroppedReason = 'disabled_by_spec' | 'execution_failure' | 'none_declared';

export interface DroppedDimension {
  readonly dimension: Dimension;
  readonly reason: DroppedReason;
  readonly declared: number;
  readonly executed: number;
}

// Moved from src/pipeline/types.ts so the report can carry it; the pipeline re-exports it (FR-14)
export interface StageTimingEntry {
  readonly name: string;
  readonly durationMs: number;
  readonly status: 'success' | 'warning' | 'error' | 'skipped';
}

export interface StageTimings {
  readonly stages: readonly StageTimingEntry[];
  readonly totalMs: number;
}

// FR-23: judge provenance; 'none' = no provider built (symbolic-only)
export type JudgeProviderName = 'claude-cli' | 'gemini' | 'mock' | 'null' | 'none';

export interface ProviderDescription {
  readonly provider: JudgeProviderName;
  readonly model: string;                // 'none' when provider is 'none'
  readonly effort?: LLMEffort;
  readonly cliVersion?: string;          // claude-cli only
}

export interface JudgeProvenance extends ProviderDescription {
  readonly cassetteMode?: VCRMode;       // absent when provider is 'none'
  readonly runsPerUnit: number;          // 0 when provider is 'none'
}

// FR-13, FR-14: what the scoring stage produces; run-level fields are added by the report builder (U3)
export type ScoredReport = Omit<EvaluationReport,
  'warnings' | 'functionExecution' | 'functionResults' | 'graphStats' | 'layerAnnotation' |
  'parseCoverage' | 'importResolution' | 'timings' | 'judge'>;

export interface EvaluationReport {
  readonly runId: RunId;
  readonly projectPath: string;
  readonly specVersion: string;
  readonly ahsDeterministic: AHSScore;
  readonly ahsCombined?: AHSScore;
  readonly ahsNeuronal?: AHSScore;
  readonly verdict: import('./enums.js').OverallVerdict;
  readonly perDimensionScores: readonly PerDimensionScore[];
  readonly violations: readonly Violation[];
  readonly universalMetrics: UniversalHealthMetrics;
  readonly evaluationMode: EvaluationMode;
  readonly durationMs: number;
  readonly warnings: readonly PipelineWarning[];
  // FR-13, FR-14, FR-15, FR-23: optional and not filled until U3 freezes the report schema (D-U0-2)
  readonly functionExecution?: FunctionExecution;
  readonly functionResults?: readonly FunctionResultRow[];
  readonly graphStats?: GraphStats;
  readonly layerAnnotation?: LayerAnnotationSummary;
  readonly parseCoverage?: ParseCoverage;
  readonly importResolution?: ImportResolutionStats;
  readonly timings?: StageTimings;
  readonly droppedDimensions?: readonly DroppedDimension[];
  readonly judge?: JudgeProvenance;
}

// Forward ref type used by CypherRule in spec.ts — re-exported for convenience
export type { CypherRule };
