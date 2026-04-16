import type { PipelineCommand } from '../../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../../shared/context/firewall-context.js';
import type { DomainResult as DomainResultType } from '../../shared/errors/domain-result.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import { createBaseline, saveBaseline } from '../../baseline/index.js';

export class CreateBaselineCommand implements PipelineCommand {
  readonly name = 'create-baseline';

  constructor(
    private readonly specFilePath: string,
    private readonly outputPath: string,
  ) {}

  async execute(context: FirewallContext): Promise<DomainResultType<void>> {
    const report = context.getReport();
    const snapshot = createBaseline(report.violations, this.specFilePath);

    const saveResult = saveBaseline(snapshot, this.outputPath);
    if (!saveResult.success) {
      return DomainResult.fail<void>(
        saveResult.errors.map((e) => ({
          code: e.code,
          message: e.message,
          stage: this.name,
          critical: true,
        })),
      );
    }

    context.addAuditEntry({
      timestamp: new Date().toISOString(),
      stage: this.name,
      event: `Baseline created with ${snapshot.totalViolations} violation(s) at ${this.outputPath}`,
      metadata: {
        totalViolations: snapshot.totalViolations,
        outputPath: this.outputPath,
      },
    });

    return DomainResult.ok(undefined);
  }
}
