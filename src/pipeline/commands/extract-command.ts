import type { PipelineCommand } from '../../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../../shared/context/firewall-context.js';
import type { DomainResult as DomainResultType } from '../../shared/errors/domain-result.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import { extractAPG } from '../../apg-extractor/index.js';
import { toPipelineError, toPipelineWarning } from './map-helpers.js';

export class ExtractCommand implements PipelineCommand {
  readonly name = 'extract-apg';

  constructor(private readonly projectPath: string) {}

  async execute(context: FirewallContext): Promise<DomainResultType<void>> {
    const result = await extractAPG(this.projectPath);

    if (!result.success) {
      return DomainResult.fail<void>(
        result.errors.map((e) => toPipelineError(e, this.name, true)),
      );
    }

    context.setApgResult(result.data);

    if (result.warnings) {
      for (const w of result.warnings) {
        context.addWarning(toPipelineWarning(w, this.name));
      }
    }

    context.addAuditEntry({
      timestamp: new Date().toISOString(),
      stage: this.name,
      event: `Extracted APG: ${result.data.nodes.length} nodes, ${result.data.edges.length} edges (${result.data.parseCoverage.percentage}% coverage)`,
    });

    return DomainResult.ok(undefined);
  }
}
