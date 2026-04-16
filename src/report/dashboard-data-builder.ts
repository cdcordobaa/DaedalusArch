import type { EvaluationReport } from '../shared/types/evaluation.js';
import type { ParsedSpec } from '../shared/types/spec.js';
import type { APGResult } from '../shared/types/apg.js';
import type { BaselineResult } from '../shared/types/baseline.js';
import type { ActionableViolation } from '../shared/taxonomy/violation-types.js';
import type {
  DashboardData,
  HeaderData,
  AHSScoreData,
  DimensionScoreData,
  FitnessFunctionCardData,
  BaselineSplitData,
  SummaryStatsData,
} from './types.js';

/**
 * Build the header section data.
 */
function buildHeader(
  report: EvaluationReport,
  projectName: string,
): HeaderData {
  return {
    productName: 'Architectonic Firewall',
    projectName,
    evaluationTimestamp: new Date().toISOString(),
    specVersion: report.specVersion,
  };
}

/**
 * Build AHS score section with dimension breakdown.
 */
function buildAHSScore(report: EvaluationReport): AHSScoreData {
  const dimensions: DimensionScoreData[] = report.perDimensionScores.map((d) => ({
    dimension: d.dimension,
    avr: Number(d.avr),
    score: 1 - Number(d.avr),
    weight: d.weight,
    violationCount: d.violationCount,
    functionCount: d.functionCount,
  }));

  return {
    deterministic: Number(report.ahsDeterministic),
    ...(report.ahsCombined !== undefined ? { combined: Number(report.ahsCombined) } : {}),
    ...(report.ahsNeuronal !== undefined ? { neuronal: Number(report.ahsNeuronal) } : {}),
    verdict: report.verdict,
    dimensions,
  };
}

/**
 * Build fitness function card data from evaluation results.
 */
function buildFitnessFunctionCards(
  report: EvaluationReport,
  spec: ParsedSpec,
): FitnessFunctionCardData[] {
  return spec.fitnessFunctions
    .filter((ff) => ff.enabled)
    .map((ff) => {
      const violationsForFunction = report.violations.filter(
        (v) => v.functionId === ff.id,
      );
      const passed = violationsForFunction.length === 0;
      const violationCount = violationsForFunction.length;

      // Score: 1.0 if passed, otherwise proportion of non-violations
      // We use a simple heuristic: if there are violations, score scales inversely
      const score = passed ? 1.0 : Math.max(0, 1 - violationCount * 0.1);

      return {
        id: String(ff.id),
        name: ff.name,
        dimension: ff.dimension,
        passed,
        score,
        ...(ff.threshold !== undefined ? { threshold: ff.threshold } : {}),
        severity: ff.severity,
        violationCount,
      };
    });
}

/**
 * Build baseline split data if baseline result is available.
 */
function buildBaselineSplit(
  baselineResult: BaselineResult | undefined,
): BaselineSplitData | null {
  if (!baselineResult) return null;

  return {
    baselineCount: baselineResult.baselineViolations.length,
    newCount: baselineResult.newViolations.length,
    removedCount: baselineResult.removedFromBaseline.length,
    baselineFilePath: baselineResult.baselineFilePath,
  };
}

/**
 * Build summary statistics.
 */
function buildSummaryStats(
  report: EvaluationReport,
  apgResult: APGResult,
  spec: ParsedSpec,
): SummaryStatsData {
  const fileNodes = apgResult.nodes.filter((n) => n.type === 'File');
  const uniqueLayers = new Set(
    fileNodes
      .map((n) => n.layer)
      .filter((l): l is string => l !== undefined),
  );

  const totalFunctions = spec.fitnessFunctions.filter((ff) => ff.enabled).length;
  const passingFunctions = spec.fitnessFunctions.filter((ff) => {
    if (!ff.enabled) return false;
    return !report.violations.some((v) => v.functionId === ff.id);
  }).length;

  const compliancePercentage = totalFunctions > 0
    ? Math.round((passingFunctions / totalFunctions) * 100)
    : 100;

  return {
    totalFiles: fileNodes.length,
    totalComponents: apgResult.nodes.filter((n) => n.type === 'Class' || n.type === 'Interface').length,
    layersDetected: uniqueLayers.size,
    compliancePercentage,
    evaluationMode: report.evaluationMode,
    durationMs: report.durationMs,
  };
}

/**
 * Build the complete dashboard data from evaluation inputs.
 */
export function buildDashboardData(
  report: EvaluationReport,
  spec: ParsedSpec,
  apgResult: APGResult,
  actionableViolations: readonly ActionableViolation[],
  projectName: string,
  baselineResult?: BaselineResult | undefined,
): DashboardData {
  return {
    header: buildHeader(report, projectName),
    ahsScore: buildAHSScore(report),
    fitnessFunctions: buildFitnessFunctionCards(report, spec),
    violations: actionableViolations,
    baseline: buildBaselineSplit(baselineResult),
    summary: buildSummaryStats(report, apgResult, spec),
  };
}
