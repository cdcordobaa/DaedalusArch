import type { PipelineCommand } from '../../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../../shared/context/firewall-context.js';
import type { DomainResult as DomainResultType } from '../../shared/errors/domain-result.js';
import type { GraphRepository } from '../../shared/interfaces/graph-repository.js';
import type { EvaluationMode } from '../../shared/types/enums.js';
import type { ScoringWeights, VerdictThresholds, ConfidenceThresholds, FitnessFunction } from '../../shared/types/spec.js';
import type { FunctionId } from '../../shared/types/value-objects.js';
import type { PipelineWarning } from '../../shared/errors/domain-result.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import { computeScoredReport } from '../../scoring-engine/index.js';
import type { CycleMetricTiming, NeuralAggregation } from '../../scoring-engine/index.js';
import { toPipelineError, toPipelineWarning } from './map-helpers.js';

export interface ScoreCommandConfig {
  readonly scoringWeights: ScoringWeights;
  readonly fullModeWeights?: ScoringWeights;
  readonly verdictThresholds: VerdictThresholds;
  readonly confidenceThresholds: ConfidenceThresholds;
  readonly evaluationMode: EvaluationMode;
  readonly projectPath: string;
  readonly specVersion: string;
  /** Spec functions in scope, enabled or not: declared counts by dimension (BR-U3-34). */
  readonly fitnessFunctions: readonly FitnessFunction[];
  /** Receives the universal cycle metric's own timing (ADR-016 e; ADR-021 SO2; audit SO2-2). */
  readonly onCycleMetricTiming?: (timing: CycleMetricTiming) => void;
  /** ADR-028: `registered` (default) or `proportional`. */
  readonly neuralAggregation?: NeuralAggregation;
}

/** U4's warning for a neural function with zero selected units (U4 BR-U4-AGG-09). */
const JUDGE_NO_UNITS = 'JUDGE_NO_UNITS';

/** Ids named by `JUDGE_NO_UNITS` warnings (`context.functionId`), ascending; the builder checks completeness (R9). */
export function noJudgeUnitIds(warnings: readonly PipelineWarning[]): readonly FunctionId[] {
  const ids = new Set<string>();
  for (const w of warnings) {
    const id = w.code === JUDGE_NO_UNITS ? w.context?.functionId : undefined;
    if (typeof id === 'string' && id.length > 0) ids.add(id);
  }
  return [...ids].sort() as FunctionId[];
}

export class ScoreCommand implements PipelineCommand {
  readonly name = 'compute-scores';

  constructor(
    private readonly graphRepository: GraphRepository,
    private readonly config: ScoreCommandConfig,
  ) {}

  async execute(context: FirewallContext): Promise<DomainResultType<void>> {
    const evaluationResults = context.getEvaluationResults();
    // The APG feeds the SCC cycle path (BR-U3-45; read only when CYCLE_STRATEGY === 'scc').
    const apg = context.snapshot().apgResult;

    const result = await computeScoredReport({
      evaluationResults,
      scoringWeights: this.config.scoringWeights,
      ...(this.config.fullModeWeights !== undefined && { fullModeWeights: this.config.fullModeWeights }),
      confidenceThresholds: this.config.confidenceThresholds,
      verdictThresholds: this.config.verdictThresholds,
      mode: this.config.evaluationMode,
      projectPath: this.config.projectPath,
      specVersion: this.config.specVersion,
      graphRepository: this.graphRepository,
      fitnessFunctions: this.config.fitnessFunctions,
      compiled: context.getCompiledFunctions(),
      noJudgeUnits: noJudgeUnitIds(context.warnings),
      ...(apg !== undefined && { apg }),
      ...(this.config.onCycleMetricTiming !== undefined && { onCycleMetricTiming: this.config.onCycleMetricTiming }),
      ...(this.config.neuralAggregation !== undefined && { neuralAggregation: this.config.neuralAggregation }),
    });

    if (!result.success) {
      return DomainResult.fail<void>(
        result.errors.map((e) => toPipelineError(e, this.name, true)),
      );
    }

    // The scored report only; AssembleReportCommand builds the one EvaluationReport (BR-U3-50).
    context.setScoredReport(result.data);

    if (result.warnings) {
      for (const w of result.warnings) {
        context.addWarning(toPipelineWarning(w, this.name));
      }
    }

    const report = result.data;
    context.addAuditEntry({
      timestamp: new Date().toISOString(),
      stage: this.name,
      event: `Scoring complete: ${report.scoring.verdictSource}=${String(report[report.scoring.verdictSource])}, verdict=${report.verdict}, ${String(report.violations.length)} violations`,
      metadata: {
        verdict: report.verdict,
        verdictSource: report.scoring.verdictSource,
        ...(report.ahsDeterministic !== undefined && { ahsDeterministic: report.ahsDeterministic }),
        ...(report.ahsCombined !== undefined && { ahsCombined: report.ahsCombined }),
        violationCount: report.violations.length,
        durationMs: report.durationMs,
      },
    });

    return DomainResult.ok(undefined);
  }
}
