import type { Dimension, Severity, EvaluationMode } from './enums.js';
import type { DriftReport } from './drift.js';
import type { AVRScore, AHSScore, Confidence, FunctionId, RunId } from './value-objects.js';
import type { SemanticCriteria, CypherRule } from './spec.js';
import type { Violation } from '../taxonomy/violation-types.js';
import type { DomainWarning, PipelineWarning } from '../errors/domain-result.js';

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
  readonly warnings: readonly DomainWarning[];
}

export interface SymbolicFunctionResult {
  readonly functionId: FunctionId;
  readonly passed: boolean;
  readonly violations: readonly Violation[];
  readonly executionTimeMs: number;
  readonly deterministic: true;
}

export interface NeuronalRun {
  readonly runIndex: number;
  readonly verdict: 'pass' | 'fail' | 'warning';
  readonly confidence: Confidence;
  readonly reasoning: string;
}

export interface NeuronalFunctionResult {
  readonly functionId: FunctionId;
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
  readonly abstractionRatio: number;
  readonly averageInstability: number;
  readonly orphanFileCount: number;
}

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
}

// Forward ref type used by CypherRule in spec.ts — re-exported for convenience
export type { CypherRule };
