import type { PipelineCommand } from '../../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../../shared/context/firewall-context.js';
import type { DomainResult as DomainResultType } from '../../shared/errors/domain-result.js';
import type { GraphRepository } from '../../shared/interfaces/graph-repository.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import { evaluateSymbolic } from '../../evaluation-engine/index.js';
import { toPipelineError, toPipelineWarning } from './map-helpers.js';

export class SymbolicEvaluateCommand implements PipelineCommand {
  readonly name = 'evaluate-symbolic';

  constructor(private readonly graphRepository: GraphRepository) {}

  async execute(context: FirewallContext): Promise<DomainResultType<void>> {
    const compiledFunctions = context.getCompiledFunctions();

    const result = await evaluateSymbolic({
      queries: compiledFunctions.symbolicQueries,
      graphRepository: this.graphRepository,
    });

    if (!result.success) {
      return DomainResult.fail<void>(
        result.errors.map((e) => toPipelineError(e, this.name, true)),
      );
    }

    // Set evaluation results with symbolic only (empty neuronal)
    context.setEvaluationResults({
      symbolicResults: result.data.results,
      neuronalResults: [],
    });

    for (const w of result.data.warnings) {
      context.addWarning(toPipelineWarning(w, this.name));
    }

    if (result.warnings) {
      for (const w of result.warnings) {
        context.addWarning(toPipelineWarning(w, this.name));
      }
    }

    const passCount = result.data.results.filter((r) => r.passed).length;
    context.addAuditEntry({
      timestamp: new Date().toISOString(),
      stage: this.name,
      event: `Symbolic evaluation complete: ${passCount}/${result.data.results.length} passed`,
    });

    return DomainResult.ok(undefined);
  }
}
