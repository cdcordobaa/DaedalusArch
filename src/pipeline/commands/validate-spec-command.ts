import type { PipelineCommand } from '../../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../../shared/context/firewall-context.js';
import type { DomainResult as DomainResultType } from '../../shared/errors/domain-result.js';
import type { ValidationReport } from '../../shared/types/validation.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import { validateSpecAgainstProject } from '../../spec-parser/spec-validator.js';

export class ValidateSpecCommand implements PipelineCommand {
  readonly name = 'validate-spec';

  constructor(private readonly projectPath: string) {}

  async execute(context: FirewallContext): Promise<DomainResultType<void>> {
    const spec = context.getParsedSpec();
    const report: ValidationReport = validateSpecAgainstProject(spec, this.projectPath);

    context.addAuditEntry({
      timestamp: new Date().toISOString(),
      stage: this.name,
      event: report.valid
        ? `Spec valid: ${report.summary.totalFunctions} functions, ${report.summary.totalLayers} layers, 0 errors`
        : `Spec validation failed with ${report.summary.totalErrors} error(s)`,
      metadata: {
        totalFunctions: report.summary.totalFunctions,
        enabledFunctions: report.summary.enabledFunctions,
        disabledFunctions: report.summary.disabledFunctions,
        totalLayers: report.summary.totalLayers,
        errorCount: report.summary.totalErrors,
        warningCount: report.summary.totalWarnings,
      },
    });

    if (!report.valid) {
      return DomainResult.fail<void>(
        report.errors.map((e) => ({
          code: e.code,
          message: e.message,
          stage: this.name,
          critical: true,
        })),
      );
    }

    for (const w of report.warnings) {
      context.addWarning({ code: w.code, message: w.message, stage: this.name });
    }

    return DomainResult.ok(undefined);
  }
}
