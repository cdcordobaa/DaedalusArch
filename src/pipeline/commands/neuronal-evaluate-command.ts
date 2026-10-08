import type { PipelineCommand } from '../../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../../shared/context/firewall-context.js';
import type { DomainResult as DomainResultType } from '../../shared/errors/domain-result.js';
import type { GraphRepository } from '../../shared/interfaces/graph-repository.js';
import type { LLMProvider } from '../../shared/interfaces/llm-provider.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import { evaluateNeuronal } from '../../llm-critic/index.js';
import { finishJudgeStage, prepareJudgeStage } from '../../llm-critic/judge-stage.js';
import type { JudgeStageSettings } from '../../llm-critic/judge-stage.js';
import { toPipelineError, toPipelineWarning } from './map-helpers.js';

export class NeuronalEvaluateCommand implements PipelineCommand {
  readonly name = 'evaluate-neuronal';

  constructor(
    private readonly graphRepository: GraphRepository,
    private readonly llmProvider: LLMProvider,
    // U4 C9 hunk (D-U4-7, D-U4-8): judge stage settings; absent → the critic runs with its defaults
    private readonly judge?: JudgeStageSettings,
  ) {}

  async execute(context: FirewallContext): Promise<DomainResultType<void>> {
    const compiledFunctions = context.getCompiledFunctions();

    // U4 C9 hunk: provider wrapped once, baseline read, options from the spec (exit 2 on failure)
    let provider = this.llmProvider;
    let judgeInput: Partial<Parameters<typeof evaluateNeuronal>[0]> = {};
    if (this.judge !== undefined) {
      const prepared = await prepareJudgeStage(this.llmProvider, this.judge, context.getParsedSpec());
      if (!prepared.success) {
        return DomainResult.fail(prepared.errors.map((e) => toPipelineError(e, this.name, true)));
      }
      provider = prepared.data.provider;
      judgeInput = {
        projectRoot: this.judge.projectRoot,
        options: prepared.data.options,
        excludePaths: prepared.data.excludePaths,
        knownSecrets: this.judge.knownSecrets,
      };
    }

    const result = await evaluateNeuronal({
      instructions: compiledFunctions.neuronalInstructions,
      graphRepository: this.graphRepository,
      provider,
      ...judgeInput,
    });

    if (!result.success) {
      return DomainResult.fail<void>(
        result.errors.map((e) => toPipelineError(e, this.name, true)),
      );
    }

    for (const w of result.data.warnings) {
      context.addWarning(toPipelineWarning(w, this.name));
    }

    if (result.warnings) {
      for (const w of result.warnings) {
        context.addWarning(toPipelineWarning(w, this.name));
      }
    }

    // U4 C9 hunk: an incomplete judge run writes its manifest and stops (exit 3, no report, BR-U4-AGG-03)
    const heldProvider = this.judge?.holder.provider;
    if (this.judge !== undefined && heldProvider !== undefined) {
      const finished = finishJudgeStage(this.judge, heldProvider, {
        output: result.data,
        completeness: result.data.completeness,
        ...(result.data.manifest !== undefined && { manifest: result.data.manifest }),
      });
      if (!finished.success) {
        return DomainResult.fail(finished.errors.map((e) => toPipelineError(e, this.name, true)));
      }
    }

    // Set evaluation results with neuronal only (empty symbolic); critic failures forwarded (FR-13)
    context.setEvaluationResults({
      symbolicResults: [],
      neuronalResults: result.data.results,
      failures: result.data.failures,
    });

    const passCount = result.data.results.filter((r) => r.verdict === 'pass').length;
    context.addAuditEntry({
      timestamp: new Date().toISOString(),
      stage: this.name,
      event: `Neuronal evaluation complete: ${passCount}/${result.data.results.length} passed, ${String(result.data.failures.length)} failed`,
    });

    return DomainResult.ok(undefined);
  }
}
