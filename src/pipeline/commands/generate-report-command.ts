import type { PipelineCommand } from '../../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../../shared/context/firewall-context.js';
import type { DomainResult as DomainResultType } from '../../shared/errors/domain-result.js';
import type { BaselineResult } from '../../shared/types/baseline.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import { generateReport } from '../../report/report-generator.js';

export interface GenerateReportConfig {
  readonly projectName: string;
  readonly specFilePath: string;
  readonly outputPath: string;
  readonly baselineResult?: BaselineResult | undefined;
}

/**
 * Pipeline command that generates an HTML report from the evaluation context.
 * Must run after ScoreCommand (requires EvaluationReport, ParsedSpec, APGResult).
 */
export class GenerateReportCommand implements PipelineCommand {
  readonly name = 'generate-report';

  constructor(private readonly config: GenerateReportConfig) {}

  async execute(context: FirewallContext): Promise<DomainResultType<void>> {
    const report = context.getReport();
    const parsedSpec = context.getParsedSpec();
    const apgResult = context.getApgResult();

    const result = generateReport({
      evaluationReport: report,
      parsedSpec,
      apgResult,
      baselineResult: this.config.baselineResult,
      projectName: this.config.projectName,
      specFilePath: this.config.specFilePath,
      outputPath: this.config.outputPath,
    });

    if (result.success) {
      context.addAuditEntry({
        timestamp: new Date().toISOString(),
        stage: 'generate-report',
        event: `HTML report written to ${result.data.outputPath}`,
        metadata: {
          outputPath: result.data.outputPath,
          sections: result.data.sections,
        },
      });
      return DomainResult.ok(undefined);
    }

    return DomainResult.fail(result.errors);
  }
}
