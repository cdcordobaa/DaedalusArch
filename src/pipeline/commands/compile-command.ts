import type { PipelineCommand } from '../../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../../shared/context/firewall-context.js';
import type { DomainResult as DomainResultType } from '../../shared/errors/domain-result.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import { compileFunctions } from '../../fitness-compiler/index.js';
import { toPipelineError, toPipelineWarning } from './map-helpers.js';

export class CompileCommand implements PipelineCommand {
  readonly name = 'compile-functions';

  async execute(context: FirewallContext): Promise<DomainResultType<void>> {
    const parsedSpec = context.getParsedSpec();

    const result = compileFunctions({
      fitnessFunctions: parsedSpec.fitnessFunctions,
      adrRules: parsedSpec.adrRules,
      layerModel: parsedSpec.layerModel,
      scoringWeights: parsedSpec.scoringWeights,
    });

    if (!result.success) {
      return DomainResult.fail<void>(
        result.errors.map((e) => toPipelineError(e, this.name, true)),
      );
    }

    context.setCompiledFunctions(result.data);

    if (result.warnings) {
      for (const w of result.warnings) {
        context.addWarning(toPipelineWarning(w, this.name));
      }
    }

    context.addAuditEntry({
      timestamp: new Date().toISOString(),
      stage: this.name,
      event: `Compiled ${result.data.totalCompiled} functions: ${result.data.symbolicQueries.length} symbolic, ${result.data.neuronalInstructions.length} neuronal, ${result.data.hybridPairs.length} hybrid`,
    });

    return DomainResult.ok(undefined);
  }
}
