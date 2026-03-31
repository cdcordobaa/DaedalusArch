import type { PipelineCommand } from '../../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../../shared/context/firewall-context.js';
import type { DomainResult as DomainResultType } from '../../shared/errors/domain-result.js';
import type { GraphRepository } from '../../shared/interfaces/graph-repository.js';
import type { LLMProvider } from '../../shared/interfaces/llm-provider.js';
import type { EvaluationMode } from '../../shared/types/enums.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import { routeAndEvaluate } from '../../neuro-symbolic-router/index.js';
import { toPipelineError, toPipelineWarning } from './map-helpers.js';

export class RouteEvaluateCommand implements PipelineCommand {
  readonly name = 'route-evaluate';

  constructor(
    private readonly graphRepository: GraphRepository,
    private readonly llmProvider: LLMProvider,
    private readonly evaluationMode: EvaluationMode,
  ) {}

  async execute(context: FirewallContext): Promise<DomainResultType<void>> {
    const compiledFunctions = context.getCompiledFunctions();

    const result = await routeAndEvaluate({
      compiledFunctions,
      mode: this.evaluationMode,
      graphRepository: this.graphRepository,
      llmProvider: this.llmProvider,
    });

    if (!result.success) {
      return DomainResult.fail<void>(
        result.errors.map((e) => toPipelineError(e, this.name, true)),
      );
    }

    context.setEvaluationResults(result.data);

    if (result.warnings) {
      for (const w of result.warnings) {
        context.addWarning(toPipelineWarning(w, this.name));
      }
    }

    context.addAuditEntry({
      timestamp: new Date().toISOString(),
      stage: this.name,
      event: `Routed evaluation (mode=${this.evaluationMode}): ${result.data.symbolicResults.length} symbolic + ${result.data.neuronalResults.length} neuronal results`,
    });

    return DomainResult.ok(undefined);
  }
}
