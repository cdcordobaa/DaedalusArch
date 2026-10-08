import type { EvaluationReport, ReportScoring, ScoredReport } from '../shared/types/evaluation.js';
import type { PipelineStage } from '../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../shared/context/firewall-context.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import { runId as makeRunId } from '../shared/types/value-objects.js';
import type { ScoringError, ScoringInput } from './types.js';
import { scoreDimensions } from './score-computer.js';
import { determineVerdict } from './verdict.js';
import { computeUniversalMetrics } from './universal-metrics.js';

/**
 * Scoring stage output (business-logic-model.md §6): per-dimension rows, dropped dimensions, the AHS
 * variants of the mode, the verdict from the mode's verdict source (BR-U3-36) and universal metrics.
 * Fails with `CONFIG_MISSING_FULL_MODE_WEIGHTS` or `SCORING_NO_EXECUTED_WEIGHT` (BR-U3-37).
 */
export async function computeScoredReport(input: ScoringInput): Promise<DomainResult<ScoredReport>> {
  const start = Date.now();

  const scored = scoreDimensions({
    evaluationResults: input.evaluationResults,
    scoringWeights: input.scoringWeights,
    ...(input.fullModeWeights !== undefined && { fullModeWeights: input.fullModeWeights }),
    confidenceThresholds: input.confidenceThresholds,
    mode: input.mode,
    fitnessFunctions: input.fitnessFunctions,
    disabledFunctions: input.compiled.disabledFunctions,
    noJudgeUnits: input.noJudgeUnits,
  });
  if (!scored.ok) {
    const error: ScoringError = { code: scored.code, stage: 'scoring-engine', critical: true, message: scored.message };
    return DomainResult.fail([error]);
  }
  const { perDimensionScores, droppedDimensions, ahsDeterministic, ahsCombined, ahsNeuronal, verdictSource } = scored.value;
  const verdictAHS = verdictSource === 'ahsDeterministic' ? ahsDeterministic : verdictSource === 'ahsCombined' ? ahsCombined : ahsNeuronal;
  if (verdictAHS === undefined) {
    const error: ScoringError = {
      code: 'SCORING_NO_EXECUTED_WEIGHT', stage: 'scoring-engine', critical: true,
      message: `No ${verdictSource} value; no score is produced`,
    };
    return DomainResult.fail([error]);
  }
  const verdict = determineVerdict(verdictAHS, input.verdictThresholds);

  // Universal metrics
  const metricsResult = await computeUniversalMetrics(input.graphRepository);
  const universalMetrics = metricsResult.success
    ? metricsResult.data
    : { cyclicDependencyCount: 0, maxFanOut: 0, maxFanIn: 0, abstractionRatio: 0, averageInstability: 0, orphanFileCount: 0 };

  // Violations of executed functions only: a failed function contributes none (BR-U3-53), and a hybrid
  // symbolic half that found violations counts no neural result.
  const failed = new Set((input.evaluationResults.failures ?? []).map((f) => String(f.functionId)));
  const neuralSkipped = new Set(input.evaluationResults.symbolicResults
    .filter((r) => r.neuralSkipped !== undefined)
    .map((r) => String(r.functionId)));
  const allViolations = [
    ...input.evaluationResults.symbolicResults
      .filter((r) => !failed.has(String(r.functionId)))
      .flatMap((r) => r.violations),
    ...input.evaluationResults.neuronalResults
      .filter((r) => !failed.has(String(r.functionId)) && !neuralSkipped.has(String(r.functionId)))
      .flatMap((r) => r.violations),
  ];

  const scoring: ReportScoring = {
    weights: input.scoringWeights,
    ...(input.fullModeWeights !== undefined && { fullModeWeights: input.fullModeWeights }),
    thresholds: input.verdictThresholds,
    confidenceThresholds: input.confidenceThresholds,
    verdictSource,
  };

  return DomainResult.ok<ScoredReport>({
    runId: makeRunId(`run-${Date.now()}`),
    projectPath: input.projectPath,
    specVersion: input.specVersion,
    ...(ahsDeterministic !== undefined ? { ahsDeterministic } : {}),
    ...(ahsCombined !== undefined ? { ahsCombined } : {}),
    ...(ahsNeuronal !== undefined ? { ahsNeuronal } : {}),
    verdict,
    scoring,
    perDimensionScores,
    violations: allViolations,
    universalMetrics,
    evaluationMode: input.mode,
    durationMs: Date.now() - start,
    droppedDimensions,
  });
}

/**
 * Compute the evaluation report: the scored report plus run-level placeholders, until the report
 * builder is wired by `AssembleReportCommand` (U3-R9).
 */
export async function computeScores(input: ScoringInput): Promise<DomainResult<EvaluationReport>> {
  const scored = await computeScoredReport(input);
  if (!scored.success) return DomainResult.fail(scored.errors, scored.warnings);
  const report: EvaluationReport = {
    ...scored.data,
    warnings: [],
    ...runLevelPlaceholders(input),
  };
  return DomainResult.ok(report, scored.warnings);
}

/**
 * Required run-level fields (D-U0-2, BR-U3-55) before the report builder exists. Placeholders only:
 * `buildEvaluationReport` replaces every one of them when `AssembleReportCommand` is wired (U3-R9).
 */
function runLevelPlaceholders(input: ScoringInput): Pick<EvaluationReport,
  'functionExecution' | 'functionResults' | 'disabledFunctions' | 'graphStats' | 'layerAnnotation' |
  'parseCoverage' | 'importResolution' | 'timings' | 'judge'> {
  const results = input.evaluationResults;
  const failed = results.failures ?? [];
  const executed = results.symbolicResults.length + results.neuronalResults.length;
  const compiled = executed + failed.length;
  return {
    functionExecution: {
      declared: compiled, adrDerived: 0, compiled, disabled: 0, dropped: [],
      skippedByMode: 0, noJudgeUnits: [], executed, failed,
    },
    functionResults: [],
    disabledFunctions: [],
    graphStats: { nodeCount: 0, edgeCount: 0, layerCoverage: 0, nodeCountByType: {}, edgeCountByType: {} },
    layerAnnotation: { mapped: 0, unmapped: 0, unmappedFiles: [] },
    parseCoverage: { total: 0, parsed: 0, percentage: 0, skipped: [] },
    importResolution: {
      resolvedInternal: 0, external: 0, unresolved: 0, unsupportedDynamic: 0,
      externalOutOfRootAlias: 0, droppedNoFileNode: 0,
    },
    timings: { stages: [], totalMs: 0 },
    judge: { provider: 'none', model: 'none', runsPerUnit: 0 },
  };
}

/**
 * PipelineStage implementation for Scoring Engine. Unwired residual (BR-U3-85): only the compile fix
 * writing the `ScoredReport` through `setScoredReport`; the pipeline uses `ScoreCommand`.
 */
export class ScoringStage implements PipelineStage<ScoringInput, ScoredReport> {
  readonly name = 'scoring-engine';

  async execute(input: ScoringInput, context: FirewallContext): Promise<DomainResult<ScoredReport>> {
    const result = await computeScoredReport(input);

    if (result.success) {
      context.setScoredReport(result.data);
      context.addAuditEntry({
        timestamp: new Date().toISOString(),
        stage: 'scoring-engine',
        event: 'Scoring completed',
        durationMs: result.data.durationMs,
        metadata: {
          ahsDeterministic: result.data.ahsDeterministic !== undefined ? Number(result.data.ahsDeterministic) : undefined,
          ahsCombined: result.data.ahsCombined !== undefined ? Number(result.data.ahsCombined) : undefined,
          verdict: result.data.verdict,
          verdictSource: result.data.scoring.verdictSource,
          violationCount: result.data.violations.length,
          mode: input.mode,
        },
      });
    }

    return result;
  }
}
