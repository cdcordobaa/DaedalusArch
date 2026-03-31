import type { PipelineCommand } from '../../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../../shared/context/firewall-context.js';
import type { DomainResult as DomainResultType } from '../../shared/errors/domain-result.js';
import type { GraphRepository } from '../../shared/interfaces/graph-repository.js';
import type { LLMProvider } from '../../shared/interfaces/llm-provider.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import { evaluateNeuronal } from '../../llm-critic/index.js';
import { toPipelineError, toPipelineWarning } from './map-helpers.js';

export class NeuronalEvaluateCommand implements PipelineCommand {
  readonly name = 'evaluate-neuronal';

  constructor(
    private readonly graphRepository: GraphRepository,
    private readonly llmProvider: LLMProvider,
  ) {}

  async execute(context: FirewallContext): Promise<DomainResultType<void>> {
    const compiledFunctions = context.getCompiledFunctions();

    const result = await evaluateNeuronal({
      instructions: compiledFunctions.neuronalInstructions,
      graphRepository: this.graphRepository,
      provider: this.llmProvider,
    });

    if (!result.success) {
      return DomainResult.fail<void>(
        result.errors.map((e) => toPipelineError(e, this.name, true)),
      );
    }

    // Set evaluation results with neuronal only (empty symbolic)
    context.setEvaluationResults({
      symbolicResults: [],
      neuronalResults: result.data.results,
    });

    for (const w of result.data.warnings) {
      context.addWarning(toPipelineWarning(w, this.name));
    }

    if (result.warnings) {
      for (const w of result.warnings) {
        context.addWarning(toPipelineWarning(w, this.name));
      }
    }

    const passCount = result.data.results.filter((r) => r.verdict === 'pass').length;
    context.addAuditEntry({
      timestamp: new Date().toISOString(),
      stage: this.name,
      event: `Neuronal evaluation complete: ${passCount}/${result.data.results.length} passed`,
    });

    return DomainResult.ok(undefined);
  }
}
