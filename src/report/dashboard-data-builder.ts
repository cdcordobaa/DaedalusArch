import type { EvaluationReport, EvaluationResults, NeuronalFunctionResult } from '../shared/types/evaluation.js';
import type { ParsedSpec, FitnessFunction } from '../shared/types/spec.js';
import type { APGResult } from '../shared/types/apg.js';
import type { BaselineResult } from '../shared/types/baseline.js';
import type { ActionableViolation } from '../shared/taxonomy/violation-types.js';
import type {
  DashboardData,
  HeaderData,
  AHSScoreData,
  DimensionScoreData,
  FitnessFunctionCardData,
  NeuronalVerdictData,
  PipelineTraceData,
  DualScoreData,
  BaselineSplitData,
  SummaryStatsData,
} from './types.js';

function buildHeader(report: EvaluationReport, projectName: string): HeaderData {
  return {
    productName: 'Architectonic Firewall',
    projectName,
    evaluationTimestamp: new Date().toISOString(),
    specVersion: report.specVersion,
  };
}

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

function buildDualScore(
  report: EvaluationReport,
  spec: ParsedSpec,
  evalResults?: EvaluationResults,
): DualScoreData {
  const symbolicAhs = Number(report.ahsDeterministic);
  const combinedAhs = report.ahsCombined !== undefined ? Number(report.ahsCombined) : undefined;

  const symbolicCount = spec.fitnessFunctions.filter((ff) => ff.enabled && ff.route === 'symbolic').length;
  const hybridCount = spec.fitnessFunctions.filter((ff) => ff.enabled && ff.route === 'hybrid').length;
  const neuronalSpecCount = spec.fitnessFunctions.filter(
    (ff) => ff.enabled && (ff.route === 'neuronal' || ff.route === 'hybrid'),
  ).length;

  const neuronalResults = evalResults?.neuronalResults ?? [];
  const neuronalPassed = neuronalResults.filter((r) => r.verdict === 'pass').length;
  const neuronalFailed = neuronalResults.filter((r) => r.verdict === 'fail').length;
  const hasNeuronal = neuronalResults.length > 0;

  return {
    symbolicAhs,
    ...(combinedAhs !== undefined ? { combinedAhs } : {}),
    ...(combinedAhs !== undefined ? { delta: combinedAhs - symbolicAhs } : {}),
    hasNeuronal,
    symbolicCount: symbolicCount + hybridCount,
    neuronalCount: neuronalSpecCount,
    neuronalPassed,
    neuronalFailed,
  };
}

function buildPipelineTrace(
  apgResult: APGResult,
  spec: ParsedSpec,
  report: EvaluationReport,
  evalResults?: EvaluationResults,
): PipelineTraceData {
  const enabled = spec.fitnessFunctions.filter((ff) => ff.enabled);
  const symbolicQueries = enabled.filter((ff) => ff.route === 'symbolic').length;
  const hybridPairs = enabled.filter((ff) => ff.route === 'hybrid').length;
  const neuronalCalls = enabled.filter((ff) => ff.route === 'neuronal' || ff.route === 'hybrid').length;
  const disabledFunctions = spec.fitnessFunctions.length - enabled.length;
  const llmAvailable = (evalResults?.neuronalResults.length ?? 0) > 0;

  // Surface LLM-related warnings so failed Gemini calls are visible
  const llmWarnings = report.warnings
    .filter((w) => w.stage === 'llm-critic' || w.code.startsWith('CRITIC_') || w.code.startsWith('LLM_'))
    .map((w) => ({ code: w.code, message: w.message }));

  return {
    apgNodes: apgResult.nodes.length,
    apgEdges: apgResult.edges.length,
    symbolicQueries: symbolicQueries + hybridPairs,
    neuronalCalls,
    hybridPairs,
    disabledFunctions,
    llmAvailable,
    ...(llmAvailable ? { llmModel: process.env['GEMINI_MODEL'] ?? 'gemini-2.0-flash' } : {}),
    llmWarnings,
  };
}

function findNeuronalResult(
  ff: FitnessFunction,
  results?: readonly NeuronalFunctionResult[],
): NeuronalFunctionResult | undefined {
  if (!results) return undefined;
  return results.find((r) => String(r.functionId) === String(ff.id));
}

function buildNeuronalVerdict(result: NeuronalFunctionResult): NeuronalVerdictData {
  return {
    verdict: result.verdict,
    confidence: Number(result.confidence),
    confidenceStdDev: result.confidenceStdDev,
    icc: result.icc,
    reasoning: result.reasoning,
    evidence: result.evidence,
    runCount: result.runs.length,
    flaggedUnstable: result.flaggedUnstable,
  };
}

function buildFitnessFunctionCards(
  report: EvaluationReport,
  spec: ParsedSpec,
  evalResults?: EvaluationResults,
): FitnessFunctionCardData[] {
  return spec.fitnessFunctions
    .filter((ff) => ff.enabled)
    .map((ff) => {
      const violationsForFunction = report.violations.filter((v) => v.functionId === ff.id);
      const passed = violationsForFunction.length === 0;
      const violationCount = violationsForFunction.length;
      const score = passed ? 1.0 : Math.max(0, 1 - violationCount * 0.1);

      const neuronalResult =
        ff.route === 'neuronal' || ff.route === 'hybrid'
          ? findNeuronalResult(ff, evalResults?.neuronalResults)
          : undefined;

      return {
        id: String(ff.id),
        name: ff.name,
        dimension: ff.dimension,
        passed,
        score,
        ...(ff.threshold !== undefined ? { threshold: ff.threshold } : {}),
        severity: ff.severity,
        violationCount,
        route: ff.route,
        ...(neuronalResult ? { neuronalVerdict: buildNeuronalVerdict(neuronalResult) } : {}),
      };
    });
}

function buildBaselineSplit(baselineResult: BaselineResult | undefined): BaselineSplitData | null {
  if (!baselineResult) return null;
  return {
    baselineCount: baselineResult.baselineViolations.length,
    newCount: baselineResult.newViolations.length,
    removedCount: baselineResult.removedFromBaseline.length,
    baselineFilePath: baselineResult.baselineFilePath,
  };
}

function buildSummaryStats(
  report: EvaluationReport,
  apgResult: APGResult,
  spec: ParsedSpec,
): SummaryStatsData {
  const fileNodes = apgResult.nodes.filter((n) => n.type === 'File');
  const uniqueLayers = new Set(
    fileNodes.map((n) => n.layer).filter((l): l is string => l !== undefined),
  );

  const totalFunctions = spec.fitnessFunctions.filter((ff) => ff.enabled).length;
  const passingFunctions = spec.fitnessFunctions.filter((ff) => {
    if (!ff.enabled) return false;
    return !report.violations.some((v) => v.functionId === ff.id);
  }).length;

  const compliancePercentage =
    totalFunctions > 0 ? Math.round((passingFunctions / totalFunctions) * 100) : 100;

  return {
    totalFiles: fileNodes.length,
    totalComponents: apgResult.nodes.filter((n) => n.type === 'Class' || n.type === 'Interface').length,
    layersDetected: uniqueLayers.size,
    compliancePercentage,
    evaluationMode: report.evaluationMode,
    durationMs: report.durationMs,
  };
}

export function buildDashboardData(
  report: EvaluationReport,
  spec: ParsedSpec,
  apgResult: APGResult,
  actionableViolations: readonly ActionableViolation[],
  projectName: string,
  baselineResult?: BaselineResult | undefined,
  evaluationResults?: EvaluationResults | undefined,
): DashboardData {
  return {
    header: buildHeader(report, projectName),
    ahsScore: buildAHSScore(report),
    dualScore: buildDualScore(report, spec, evaluationResults),
    pipelineTrace: buildPipelineTrace(apgResult, spec, report, evaluationResults),
    fitnessFunctions: buildFitnessFunctionCards(report, spec, evaluationResults),
    violations: actionableViolations,
    baseline: buildBaselineSplit(baselineResult),
    summary: buildSummaryStats(report, apgResult, spec),
  };
}
