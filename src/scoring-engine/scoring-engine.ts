import type { EvaluationReport } from '../shared/types/evaluation.js';
import type { PipelineStage } from '../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../shared/context/firewall-context.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import { runId as makeRunId } from '../shared/types/value-objects.js';
import type { ScoringInput } from './types.js';
import { computePerDimensionScores, computeAHS } from './score-computer.js';
import { determineVerdict } from './verdict.js';
import { computeUniversalMetrics } from './universal-metrics.js';

/**
 * Compute full evaluation report: AVR → AHS → verdict → universal metrics.
 */
export async function computeScores(input: ScoringInput): Promise<DomainResult<EvaluationReport>> {
  const start = Date.now();

  // Determine weights based on mode
  const weights = input.mode === 'full' && input.fullModeWeights
    ? input.fullModeWeights
    : input.scoringWeights;

  // Compute per-dimension scores and AVRs
  const { scores, avrs } = computePerDimensionScores(
    input.evaluationResults,
    weights,
    input.mode,
    input.confidenceThresholds,
  );

  // Compute AHS
  const ahsDeterministic = computeAHS(avrs, input.scoringWeights);
  const ahsCombined = input.mode !== 'symbolic-only' && input.fullModeWeights
    ? computeAHS(avrs, input.fullModeWeights)
    : undefined;

  // Determine verdict
  const verdictAHS = ahsCombined ?? ahsDeterministic;
  const verdict = determineVerdict(verdictAHS, input.verdictThresholds);

  // Universal metrics
  const metricsResult = await computeUniversalMetrics(input.graphRepository);
  const universalMetrics = metricsResult.success
    ? metricsResult.data
    : { cyclicDependencyCount: 0, maxFanOut: 0, maxFanIn: 0, abstractionRatio: 0, averageInstability: 0, orphanFileCount: 0 };

  // Collect all violations
  const allViolations = [
    ...input.evaluationResults.symbolicResults.flatMap((r) => r.violations),
    ...input.evaluationResults.neuronalResults.flatMap((r) => r.violations),
  ];

  const report: EvaluationReport = {
    runId: makeRunId(`run-${Date.now()}`),
    projectPath: input.projectPath,
    specVersion: input.specVersion,
    ahsDeterministic,
    ...(ahsCombined ? { ahsCombined } : {}),
    verdict,
    perDimensionScores: scores,
    violations: allViolations,
    universalMetrics,
    evaluationMode: input.mode,
    durationMs: Date.now() - start,
    warnings: [],
  };

  return DomainResult.ok(report);
}

/**
 * PipelineStage implementation for Scoring Engine.
 */
export class ScoringStage implements PipelineStage<ScoringInput, EvaluationReport> {
  readonly name = 'scoring-engine';

  async execute(input: ScoringInput, context: FirewallContext): Promise<DomainResult<EvaluationReport>> {
    const result = await computeScores(input);

    if (result.success) {
      context.setReport(result.data);
      context.addAuditEntry({
        timestamp: new Date().toISOString(),
        stage: 'scoring-engine',
        event: 'Scoring completed',
        durationMs: result.data.durationMs,
        metadata: {
          ahsDeterministic: Number(result.data.ahsDeterministic),
          ahsCombined: result.data.ahsCombined ? Number(result.data.ahsCombined) : undefined,
          verdict: result.data.verdict,
          violationCount: result.data.violations.length,
          mode: input.mode,
        },
      });
    }

    return result;
  }
}
