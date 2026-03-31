import type { PipelineCommand } from '../../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../../shared/context/firewall-context.js';
import type { DomainResult as DomainResultType } from '../../shared/errors/domain-result.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import { parseSpec } from '../../spec-parser/index.js';
import { toPipelineError, toPipelineWarning } from './map-helpers.js';

export class ParseCommand implements PipelineCommand {
  readonly name = 'parse-spec';

  constructor(private readonly specFilePath: string) {}

  async execute(context: FirewallContext): Promise<DomainResultType<void>> {
    const result = await parseSpec({ specFilePath: this.specFilePath });

    if (!result.success) {
      return DomainResult.fail<void>(
        result.errors.map((e) => toPipelineError(e, this.name, true)),
      );
    }

    context.setParsedSpec(result.data);

    if (result.warnings) {
      for (const w of result.warnings) {
        context.addWarning(toPipelineWarning(w, this.name));
      }
    }

    context.addAuditEntry({
      timestamp: new Date().toISOString(),
      stage: this.name,
      event: `Parsed spec v${result.data.specVersion}: ${result.data.fitnessFunctions.length} fitness functions, ${result.data.layerModel.layers.length} layers`,
    });

    return DomainResult.ok(undefined);
  }
}
