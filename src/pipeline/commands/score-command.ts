import type { PipelineCommand } from '../../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../../shared/context/firewall-context.js';
import type { DomainResult as DomainResultType } from '../../shared/errors/domain-result.js';
import type { GraphRepository } from '../../shared/interfaces/graph-repository.js';
import type { EvaluationMode } from '../../shared/types/enums.js';
import type { ScoringWeights, VerdictThresholds, ConfidenceThresholds } from '../../shared/types/spec.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import { computeScores } from '../../scoring-engine/index.js';
import { toPipelineError, toPipelineWarning } from './map-helpers.js';

export interface ScoreCommandConfig {
  readonly scoringWeights: ScoringWeights;
  readonly fullModeWeights?: ScoringWeights;
  readonly verdictThresholds: VerdictThresholds;
  readonly confidenceThresholds: ConfidenceThresholds;
  readonly evaluationMode: EvaluationMode;
  readonly projectPath: string;
  readonly specVersion: string;
}

export class ScoreCommand implements PipelineCommand {
  readonly name = 'compute-scores';

  constructor(
    private readonly graphRepository: GraphRepository,
    private readonly config: ScoreCommandConfig,
  ) {}

  async execute(context: FirewallContext): Promise<DomainResultType<void>> {
    const evaluationResults = context.getEvaluationResults();

    const result = await computeScores({
      evaluationResults,
      scoringWeights: this.config.scoringWeights,
      ...(this.config.fullModeWeights !== undefined && { fullModeWeights: this.config.fullModeWeights }),
      confidenceThresholds: this.config.confidenceThresholds,
      verdictThresholds: this.config.verdictThresholds,
      mode: this.config.evaluationMode,
      projectPath: this.config.projectPath,
      specVersion: this.config.specVersion,
      graphRepository: this.graphRepository,
    });

    if (!result.success) {
      return DomainResult.fail<void>(
        result.errors.map((e) => toPipelineError(e, this.name, true)),
      );
    }

    context.setReport(result.data);

    if (result.warnings) {
      for (const w of result.warnings) {
        context.addWarning(toPipelineWarning(w, this.name));
      }
    }

    const report = result.data;
    context.addAuditEntry({
      timestamp: new Date().toISOString(),
      stage: this.name,
      event: `Scoring complete: AHS(det)=${report.ahsDeterministic}${report.ahsCombined !== undefined ? `, AHS(combined)=${report.ahsCombined}` : ''}, verdict=${report.verdict}, ${report.violations.length} violations`,
      metadata: {
        verdict: report.verdict,
        ahsDeterministic: report.ahsDeterministic,
        ...(report.ahsCombined !== undefined && { ahsCombined: report.ahsCombined }),
        violationCount: report.violations.length,
        durationMs: report.durationMs,
      },
    });

    return DomainResult.ok(undefined);
  }
}
