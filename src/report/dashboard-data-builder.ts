import type { EvaluationReport, EvaluationResults, NeuronalFunctionResult } from '../shared/types/evaluation.js';
import type { ParsedSpec, FitnessFunction } from '../shared/types/spec.js';
import type { APGResult } from '../shared/types/apg.js';
import type { BaselineResult } from '../shared/types/baseline.js';
import type { ActionableViolation } from '../shared/taxonomy/violation-types.js';
import { getTemplateTag } from '../fitness-compiler/cypher-templates.js';
import { headlineAhs } from '../scoring-engine/report-formatter.js';
import { CARD_GROUP_ORDER } from './types.js';
import type {
  CardGroup,
  RunCompletenessData,
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

  // BR-U3-43: the headline is the verdict-source variant; an absent variant stays absent / null.
  const headline = headlineAhs(report);
  return {
    headline: headline.value ?? null,
    headlineSource: headline.source,
    deterministic: report.ahsDeterministic ?? null,
    ...(report.ahsCombined !== undefined ? { combined: report.ahsCombined } : {}),
    ...(report.ahsNeuronal !== undefined ? { neuronal: report.ahsNeuronal } : {}),
    verdict: report.verdict,
    dimensions,
  };
}

function buildDualScore(
  report: EvaluationReport,
  spec: ParsedSpec,
  evalResults?: EvaluationResults,
): DualScoreData {
  const symbolicAhs = report.ahsDeterministic ?? null;
  const combinedAhs = report.ahsCombined;

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
    ...(combinedAhs !== undefined && symbolicAhs !== null ? { delta: combinedAhs - symbolicAhs } : {}),
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

  // Surface LLM-related warnings so failed judge calls are visible
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
    // BR-U3-84: provider and model come from the report's judge provenance, never from the environment.
    judgeProvider: report.judge.provider,
    judgeModel: report.judge.model,
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

/** BR-U3-54 key of a card: the row's tag; neural rows `neural`; a function without a row by its template. */
function cardGroupOf(ff: FitnessFunction, rowTag: CardGroup | undefined, hasRow: boolean): CardGroup {
  if (rowTag !== undefined) return rowTag;
  if (ff.route === 'neuronal') return 'neural';
  if (hasRow) return 'untagged';
  return getTemplateTag(ff.name) ?? 'untagged';
}

/**
 * Cards for the enabled spec functions, grouped and ordered by the BR-U3-54 key (tag rank, then id).
 * Pass/fail and counts come from the report's `functionResults`; a function in
 * `functionExecution.failed` is a failed card, one without a row or failure was not run in the mode.
 */
function buildFitnessFunctionCards(
  report: EvaluationReport,
  spec: ParsedSpec,
  evalResults?: EvaluationResults,
): FitnessFunctionCardData[] {
  const rows = new Map(report.functionResults.map((r) => [String(r.functionId), r]));
  const failed = new Set(report.functionExecution.failed.map((f) => String(f.functionId)));
  const rank = (g: CardGroup): number => CARD_GROUP_ORDER.indexOf(g);
  return spec.fitnessFunctions
    .filter((ff) => ff.enabled)
    .map((ff): FitnessFunctionCardData => {
      const id = String(ff.id);
      const row = rows.get(id);
      const violationCount = row?.violationCount ?? report.violations.filter((v) => v.functionId === ff.id).length;
      const status = row !== undefined ? 'executed' : failed.has(id) ? 'failed' : 'not-run';
      const passed = row !== undefined ? row.passed : status === 'failed' ? false : violationCount === 0;
      const score = passed ? 1.0 : Math.max(0, 1 - violationCount * 0.1);
      const rowTag: CardGroup | undefined = row?.tag ?? (row?.route === 'neuronal' ? 'neural' : undefined);

      const neuronalResult =
        ff.route === 'neuronal' || ff.route === 'hybrid'
          ? findNeuronalResult(ff, evalResults?.neuronalResults)
          : undefined;

      return {
        id,
        group: cardGroupOf(ff, rowTag, row !== undefined),
        status,
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
    })
    .sort((a, b) => rank(a.group) - rank(b.group) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** BR-U3-84: the failures and dropped dimensions the report carries, unchanged. */
function buildCompleteness(report: EvaluationReport): RunCompletenessData {
  return { failed: report.functionExecution.failed, droppedDimensions: report.droppedDimensions };
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
    completeness: buildCompleteness(report),
    ahsScore: buildAHSScore(report),
    dualScore: buildDualScore(report, spec, evaluationResults),
    pipelineTrace: buildPipelineTrace(apgResult, spec, report, evaluationResults),
    fitnessFunctions: buildFitnessFunctionCards(report, spec, evaluationResults),
    violations: actionableViolations,
    baseline: buildBaselineSplit(baselineResult),
    summary: buildSummaryStats(report, apgResult, spec),
  };
}
