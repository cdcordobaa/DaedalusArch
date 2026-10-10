import type { ReportScoring, ScoredReport } from '../shared/types/evaluation.js';
import type { PipelineStage } from '../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../shared/context/firewall-context.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import { runId as makeRunId } from '../shared/types/value-objects.js';
import type { ScoringError, ScoringInput } from './types.js';
import { scoreDimensions } from './score-computer.js';
import { determineVerdict } from './verdict.js';
import { computeUniversalMetrics } from './universal-metrics.js';
import { CYCLE_STRATEGY } from '../evaluation-engine/scc-cycles.js';
import { DEFAULT_NEURAL_AGGREGATION } from './neural-aggregation.js';

/**
 * Scoring stage output (business-logic-model.md §6): per-dimension rows, dropped dimensions, the AHS
 * variants of the mode, the verdict from the mode's verdict source (BR-U3-36) and universal metrics.
 * Fails with `CONFIG_MISSING_FULL_MODE_WEIGHTS` or `SCORING_NO_EXECUTED_WEIGHT` (BR-U3-37). The
 * universal-metric warnings (`METRIC_001`, `METRIC_002`) travel as the result's warnings.
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
    neuralAggregation: input.neuralAggregation ?? DEFAULT_NEURAL_AGGREGATION,
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

  // Universal metrics (BR-U3-40..42): a failed metric is null + METRIC_001, never a silent 0.
  const metricsResult = await computeUniversalMetrics(input.graphRepository, CYCLE_STRATEGY, input.apg);
  if (!metricsResult.success) return DomainResult.fail(metricsResult.errors, metricsResult.warnings);
  const { metrics: universalMetrics, warnings: metricWarnings, cycleTiming } = metricsResult.data;
  input.onCycleMetricTiming?.(cycleTiming);

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
    // ADR-028: judge modes name their neural aggregation; symbolic-only has none.
    ...(input.mode !== 'symbolic-only' && { neuralAggregation: input.neuralAggregation ?? DEFAULT_NEURAL_AGGREGATION }),
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
  }, metricWarnings);
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
