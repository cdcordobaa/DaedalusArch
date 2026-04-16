import type { ActionableViolation } from '../shared/taxonomy/violation-types.js';
import type { EvaluationReport } from '../shared/types/evaluation.js';
import type { ParsedSpec } from '../shared/types/spec.js';
import type { APGResult } from '../shared/types/apg.js';
import type { BaselineResult } from '../shared/types/baseline.js';
import type { Dimension, Severity, OverallVerdict, EvaluationMode } from '../shared/types/enums.js';

// ── Report Generator Input / Output ──────────────────────────────────────────

export interface ReportInput {
  readonly evaluationReport: EvaluationReport;
  readonly parsedSpec: ParsedSpec;
  readonly apgResult: APGResult;
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
  readonly deterministic: number;
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

export interface FitnessFunctionCardData {
  readonly id: string;
  readonly name: string;
  readonly dimension: Dimension;
  readonly passed: boolean;
  readonly score: number;
  readonly threshold?: number | undefined;
  readonly severity: Severity;
  readonly violationCount: number;
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

export interface DashboardData {
  readonly header: HeaderData;
  readonly ahsScore: AHSScoreData;
  readonly fitnessFunctions: readonly FitnessFunctionCardData[];
  readonly violations: readonly ActionableViolation[];
  readonly baseline: BaselineSplitData | null;
  readonly summary: SummaryStatsData;
}
