import type {
  Dimension, Severity, EvaluationMode, NodeType, EdgeType, Route, TemplateTag, JudgeUnitKind,
} from './enums.js';
import type { DriftReport } from './drift.js';
import type { AVRScore, AHSScore, Confidence, FunctionId, RunId } from './value-objects.js';
import type { SemanticCriteria, CypherRule, ScoringWeights, VerdictThresholds, ConfidenceThresholds } from './spec.js';
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
  readonly truncated?: true;             // FR-35: set only when the cycle sentinel row was present (C10, U3 DE §8 row 5)
  readonly neuralSkipped?: 'symbolic-fail'; // full mode, hybrid pair whose symbolic half found violations (C10, row 6)
}

export interface NeuronalRun {
  readonly runIndex: number;
  readonly verdict: 'pass' | 'fail' | 'warning';
  readonly confidence: Confidence;
  readonly reasoning: string;
}

// FR-33 unit selection persisted for variant runs (C10 row 15; U4 DE §2.4, BR-U4-SEL-07)
export interface BaselineSelection {
  readonly functionId: FunctionId;
  readonly candidateUnitIds: readonly string[];  // all candidate ids of the baseline tree, sorted
  readonly selectedUnitIds: readonly string[];   // the baseline selection, sorted
  readonly treeSha?: string;                     // baseline tree id when known (U5a/U5b), for audit only
  readonly source?: 'own' | 'baseline';          // how the run holding this value selected; always set by C7
}

// One judged unit (FR-33). Fields marked C10 row 15 are optional in the type (U4 DE §4.3);
// C7 is the only producer and always sets them (`origin` on variant runs only).
export interface JudgeUnitResult {
  readonly unitId: string;               // file path, `Class@file`, or module directory
  readonly unitKind: JudgeUnitKind;
  readonly layer?: string;                            // C10 row 15
  readonly filePaths?: readonly string[];             // C10 row 15
  readonly status?: 'valid' | 'invalid';              // C10 row 15
  readonly verdict: 'pass' | 'fail' | 'warning';      // 'warning' for invalid units, never counted
  readonly confidence: Confidence;                    // 0 for invalid units (BR-U4-AGG-01)
  readonly confidenceStdDev: number;                  // population stddev over valid runs
  readonly flaggedUnstable?: boolean;                 // C10 row 15
  readonly validRunCount?: number;                    // C10 row 15
  readonly invalidRunCauses?: readonly InvalidCause[]; // C10 row 15, in run order
  readonly truncated?: boolean;                       // C10 row 15
  readonly origin?: 'addedByVariant';                 // C10 row 15, variant runs only
  readonly runs: readonly NeuronalRun[];              // valid runs, in runIndex order
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
  // C10 row 15 (U4 DE §4.4): optional in the type; C7 always sets them except
  // `removedByVariant` (variant runs only) and `singleFileModules` (module units only)
  readonly unitsInvalidByCause?: Readonly<Record<InvalidCause | 'INSUFFICIENT_VALID_RUNS', number>>;
  readonly singleFileModules?: number;
  readonly candidateExclusions?: Readonly<Record<ExclusionReason, number>>;
  readonly candidateCount?: number;
  readonly uncoveredFileCount?: number;
  readonly truncatedUnits?: number;
  readonly excerptTruncatedUnits?: number;
  readonly removedByVariant?: readonly string[];
  readonly selection?: BaselineSelection;              // written on every run; a baseline run supplies it to its variants
  readonly aggregationRule?: 'majority-of-valid-units-v1'; // FR-33 "stated rule"
}

export interface EvaluationResults {
  readonly symbolicResults: readonly SymbolicFunctionResult[];
  readonly neuronalResults: readonly NeuronalFunctionResult[];
  // FR-13 (C10, U3 DE §8 row 1). U4's optional form: the U4-owned router literal
  // (src/neuro-symbolic-router/router.ts) does not set it yet; consumers read `failures ?? []`.
  readonly failures?: readonly FunctionFailure[];
}

export interface PerDimensionScore {
  readonly dimension: Dimension;
  readonly avr: AVRScore;                // round3(violatedWeight / functionCount)
  readonly violatedWeight: number;       // FR-15: unrounded AVR numerator (C10, row 8)
  readonly weight: number;
  readonly effectiveWeight: number;      // FR-15: unrounded renormalised weight (D-U0-2, C10 row 8)
  readonly violationCount: number;
  readonly functionCount: number;
}

// null only with METRIC_001 (query failed) or METRIC_002 (ratio undefined) (C10, row 10; BR-U3-41, 42)
export interface UniversalHealthMetrics {
  readonly cyclicDependencyCount: number | null;
  readonly maxFanOut: number | null;
  readonly maxFanIn: number | null;
  readonly abstractionRatio: number | null;
  readonly averageInstability: number | null;
  readonly orphanFileCount: number | null;
}

// FR-13
export interface FunctionFailure {
  readonly functionId: FunctionId;
  readonly name: string;
  readonly code: string;                 // e.g. 'EVAL_001', 'CRITIC_001'
  readonly message: string;              // scrubbed (NFR-05)
}

// C10 rows 2-4 (U3 DE §3.2); identities I1-I6 are asserted by the report builder
export interface FunctionExecution {
  readonly declared: number;                    // spec functions in scope, enabled or not
  readonly adrDerived: number;                  // compiled functions with source 'adr'
  readonly compiled: number;                    // = CompiledFunctions.totalCompiled
  readonly disabled: number;                    // = disabledFunctions.length (FR-20)
  readonly dropped: readonly FunctionId[];      // declared ids that compiled to nothing, ascending
  readonly skippedByMode: number;               // compiled functions whose route the mode does not run
  readonly noJudgeUnits: readonly FunctionId[]; // neural functions with zero selected units, ascending
  readonly executed: number;                    // functions with a result and no failure (a count)
  readonly failed: readonly FunctionFailure[];  // ordered by functionId, then code
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
  readonly truncated: boolean;           // FR-35: false unless the cycle sentinel fired (C10, row 5)
}

// FR-20, BR-U5b-13 (C10, row 12): sorted by functionId; reason 'disabled in spec' when the compiler gave none
export interface DisabledFunctionRow {
  readonly functionId: FunctionId;
  readonly name: string;
  readonly reason: string;
}

// FR-15 ('no-judge-units': U4 BR-U4-AGG-09 / OI-U4-4, C10 row 13)
export type DroppedReason = 'disabled_by_spec' | 'execution_failure' | 'none_declared' | 'no-judge-units';

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
export type JudgeProviderName = 'claude-cli' | 'gemini' | 'agy' | 'mock' | 'null' | 'none';

export interface ProviderDescription {
  readonly provider: JudgeProviderName;
  readonly model: string;                // 'none' when provider is 'none'
  readonly effort?: LLMEffort;
  readonly cliVersion?: string;          // claude-cli and agy
}

export interface JudgeProvenance extends ProviderDescription {
  readonly cassetteMode?: VCRMode;       // absent when provider is 'none'
  readonly runsPerUnit: number;          // 0 when provider is 'none'
  // C10 row 15 (U4 DE §4.6); `judgeProvenanceOf(undefined)` sets none of them
  readonly resolvedModel?: string;
  readonly repetition?: number;
  readonly isolationProbeSha256?: string;   // claude-cli
  readonly configListingSha256?: string;    // claude-cli
  readonly provenanceMixed?: boolean;       // replay found differing values across entries (BR-U4-CAS-10)
  readonly seededList?: readonly string[];  // sorted; [] in every reported run (BR-U4-SEL-06)
}

// Types referenced by NeuralResultRow, verbatim from U4 DE §2.2 and §4.2 (C10 row 14 needs them;
// the rest of row 15 is U4-K1's)
export type ExclusionReason =
  | 'unlayered' | 'exclude-paths' | 'barrel' | 'test-path' | 'e2e-spec' | 'generated-path' | 'generated-marker';

export type InvalidCause =
  | 'PARSE_FAILURE' | 'MISSING_CONFIDENCE' | 'MODEL_MISMATCH'
  | 'TIMEOUT' | 'BAD_ENVELOPE' | 'CLI_EXIT';

// FR-33 report side (C10 row 14; shape owned by U4, U4 DE §4.8)
export interface NeuralUnitRow {
  readonly unitId: string; readonly unitKind: JudgeUnitKind; readonly layer: string;
  readonly filePaths: readonly string[];
  readonly status: 'valid' | 'invalid'; readonly verdict: 'pass' | 'fail' | 'warning';
  readonly confidence: number; readonly confidenceStdDev: number; readonly flaggedUnstable: boolean;
  readonly validRunCount: number; readonly origin?: 'addedByVariant';
}

export interface NeuralResultRow {
  readonly functionId: FunctionId; readonly dimension: Dimension;
  readonly aggregationRule: 'majority-of-valid-units-v1';
  readonly selection: {
    readonly source: 'own' | 'baseline';
    readonly candidateUnitIds: readonly string[];
    readonly selectedUnitIds: readonly string[];
  };
  readonly unitsSelected: number; readonly unitsCapped: number; readonly candidateCount: number;
  readonly uncoveredFileCount: number; readonly singleFileModules?: number;
  readonly candidateExclusions: Readonly<Record<ExclusionReason, number>>;
  readonly unitsInvalidByCause: Readonly<Record<InvalidCause | 'INSUFFICIENT_VALID_RUNS', number>>;
  readonly truncatedUnits: number; readonly excerptTruncatedUnits: number;
  readonly removedByVariant: readonly string[];
  readonly unitResults: readonly NeuralUnitRow[];       // sorted by unitId
}

// FR-26 re-scoring inputs (C10 row 7; U3 DE §4.5)
export interface ReportScoring {
  readonly weights: ScoringWeights;                 // scoringWeights as configured (symbolic map)
  readonly fullModeWeights?: ScoringWeights;        // present in full and neuronal-only modes
  readonly thresholds: VerdictThresholds;
  readonly confidenceThresholds: ConfidenceThresholds;
  readonly verdictSource: 'ahsDeterministic' | 'ahsCombined' | 'ahsNeuronal';
}

// FR-13, FR-14: what the scoring stage produces; run-level fields are added by the report builder (U3)
export type ScoredReport = Omit<EvaluationReport,
  'warnings' | 'functionExecution' | 'functionResults' | 'graphStats' | 'layerAnnotation' |
  'parseCoverage' | 'importResolution' | 'timings' | 'judge' | 'disabledFunctions' | 'neuralResults'>;

export interface EvaluationReport {
  readonly runId: RunId;
  readonly projectPath: string;
  readonly specVersion: string;
  readonly ahsDeterministic?: AHSScore;  // absent in neuronal-only mode (C10 row 9)
  readonly ahsCombined?: AHSScore;
  readonly ahsNeuronal?: AHSScore;
  readonly verdict: import('./enums.js').OverallVerdict;
  readonly scoring: ReportScoring;
  readonly perDimensionScores: readonly PerDimensionScore[];
  readonly violations: readonly Violation[];
  readonly universalMetrics: UniversalHealthMetrics;
  readonly evaluationMode: EvaluationMode;
  readonly durationMs: number;
  readonly warnings: readonly PipelineWarning[];
  // FR-13, FR-14, FR-15, FR-20, FR-23: required run-level fields (pre-agreed D-U0-2; C10 rows 12, 17; BR-U3-55)
  readonly functionExecution: FunctionExecution;
  readonly functionResults: readonly FunctionResultRow[];
  readonly disabledFunctions: readonly DisabledFunctionRow[];
  readonly graphStats: GraphStats;
  readonly layerAnnotation: LayerAnnotationSummary;
  readonly parseCoverage: ParseCoverage;
  readonly importResolution: ImportResolutionStats;
  readonly timings: StageTimings;
  readonly droppedDimensions: readonly DroppedDimension[];
  readonly judge: JudgeProvenance;
  // FR-33: present in full and neuronal-only modes, absent in symbolic-only (schema if/then, BR-U3-65; C10 row 14)
  readonly neuralResults?: readonly NeuralResultRow[];
}

// Forward ref type used by CypherRule in spec.ts — re-exported for convenience
export type { CypherRule };
