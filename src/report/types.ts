import type { ActionableViolation } from '../shared/taxonomy/violation-types.js';
import type { DroppedDimension, EvaluationReport, EvaluationResults, FunctionFailure, ReportScoring } from '../shared/types/evaluation.js';
import type { ParsedSpec } from '../shared/types/spec.js';
import type { APGResult } from '../shared/types/apg.js';
import type { BaselineResult } from '../shared/types/baseline.js';
import type { Dimension, Severity, OverallVerdict, EvaluationMode, Route, TemplateTag } from '../shared/types/enums.js';

// ── Report Generator Input / Output ──────────────────────────────────────────

export interface ReportInput {
  readonly evaluationReport: EvaluationReport;
  readonly parsedSpec: ParsedSpec;
  readonly apgResult: APGResult;
  readonly evaluationResults?: EvaluationResults | undefined;
  readonly baselineResult?: BaselineResult | undefined;
  readonly projectName: string;
  readonly specFilePath: string;
  readonly outputPath: string;
}

export interface ReportOutput {
  readonly htmlContent: string;
  readonly outputPath: string;
  readonly sections: readonly string[];
}

// ── Cytoscape.js Graph Types ─────────────────────────────────────────────────

export interface CytoscapeNode {
  readonly data: {
    readonly id: string;
    readonly label: string;
    readonly layer: string;
    readonly type: string;
    readonly filePath: string;
    readonly violationCount: number;
  };
}

export interface CytoscapeEdge {
  readonly data: {
    readonly id: string;
    readonly source: string;
    readonly target: string;
    readonly type: string;
    readonly isViolation: boolean;
  };
}

export interface CytoscapeGraphData {
  readonly nodes: readonly CytoscapeNode[];
  readonly edges: readonly CytoscapeEdge[];
  readonly layerColors: Readonly<Record<string, string>>;
}

// ── Dashboard Data Types ─────────────────────────────────────────────────────

export interface HeaderData {
  readonly productName: string;
  readonly projectName: string;
  readonly evaluationTimestamp: string;
  readonly specVersion: string;
}

export interface AHSScoreData {
  /** Verdict-source AHS (BR-U3-43); `null` only if the report lacks it. */
  readonly headline: number | null;
  readonly headlineSource: ReportScoring['verdictSource'];
  /** `null` when the mode does not compute it (neuronal-only); printed `n/a`. */
  readonly deterministic: number | null;
  readonly combined?: number | undefined;
  readonly neuronal?: number | undefined;
  readonly verdict: OverallVerdict;
  readonly dimensions: readonly DimensionScoreData[];
}

export interface DimensionScoreData {
  readonly dimension: Dimension;
  readonly avr: number;
  readonly score: number;
  readonly weight: number;
  readonly violationCount: number;
  readonly functionCount: number;
}

/** BR-U3-54 grouping key of a card: the template tag; `neural` for neural rows, `untagged` otherwise. */
export type CardGroup = TemplateTag | 'neural' | 'untagged';

/** Card group order (BR-U3-54: structural < topological < pattern-proxy < neural). */
export const CARD_GROUP_ORDER: readonly CardGroup[] = ['structural', 'topological', 'pattern-proxy', 'neural', 'untagged'];

export interface FitnessFunctionCardData {
  readonly id: string;
  readonly group: CardGroup;
  /** `executed`: a result row exists; `failed`: listed in `functionExecution.failed`; `not-run`: skipped by mode. */
  readonly status: 'executed' | 'failed' | 'not-run';
  readonly name: string;
  readonly dimension: Dimension;
  readonly passed: boolean;
  readonly score: number;
  readonly threshold?: number | undefined;
  readonly severity: Severity;
  readonly violationCount: number;
  readonly route: Route;
  readonly neuronalVerdict?: NeuronalVerdictData | undefined;
}

export interface NeuronalVerdictData {
  readonly verdict: 'pass' | 'fail' | 'warning';
  readonly confidence: number;
  readonly confidenceStdDev: number;
  readonly icc: number;
  readonly reasoning: string;
  readonly evidence: readonly string[];
  readonly runCount: number;
  readonly flaggedUnstable: boolean;
}

export interface PipelineTraceData {
  readonly apgNodes: number;
  readonly apgEdges: number;
  readonly symbolicQueries: number;
  readonly neuronalCalls: number;
  readonly hybridPairs: number;
  readonly disabledFunctions: number;
  readonly llmAvailable: boolean;
  /** Judge provider and model from `report.judge` (BR-U3-84); `none` when no judge ran. */
  readonly judgeProvider: string;
  readonly judgeModel: string;
  readonly llmWarnings: readonly LLMWarningData[];
}

export interface LLMWarningData {
  readonly code: string;
  readonly message: string;
}

export interface DualScoreData {
  /** `null` when the mode does not compute it (neuronal-only); printed `n/a`. */
  readonly symbolicAhs: number | null;
  readonly combinedAhs?: number | undefined;
  readonly delta?: number | undefined;
  readonly hasNeuronal: boolean;
  readonly symbolicCount: number;
  readonly neuronalCount: number;
  readonly neuronalPassed: number;
  readonly neuronalFailed: number;
}

export interface BaselineSplitData {
  readonly baselineCount: number;
  readonly newCount: number;
  readonly removedCount: number;
  readonly baselineFilePath: string;
}

export interface SummaryStatsData {
  readonly totalFiles: number;
  readonly totalComponents: number;
  readonly layersDetected: number;
  readonly compliancePercentage: number;
  readonly evaluationMode: EvaluationMode;
  readonly durationMs: number;
}

/** Functions that failed to run and dimensions left out of the score (FR-13, FR-15; BR-U3-84). */
export interface RunCompletenessData {
  readonly failed: readonly FunctionFailure[];
  readonly droppedDimensions: readonly DroppedDimension[];
}

export interface DashboardData {
  readonly header: HeaderData;
  readonly completeness: RunCompletenessData;
  readonly ahsScore: AHSScoreData;
  readonly dualScore: DualScoreData;
  readonly pipelineTrace: PipelineTraceData;
  readonly fitnessFunctions: readonly FitnessFunctionCardData[];
  readonly violations: readonly ActionableViolation[];
  readonly baseline: BaselineSplitData | null;
  readonly summary: SummaryStatsData;
}
