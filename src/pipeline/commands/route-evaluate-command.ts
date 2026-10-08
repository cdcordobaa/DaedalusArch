import type { PipelineCommand } from '../../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../../shared/context/firewall-context.js';
import type { DomainResult as DomainResultType } from '../../shared/errors/domain-result.js';
import type { GraphRepository } from '../../shared/interfaces/graph-repository.js';
import type { LLMProvider } from '../../shared/interfaces/llm-provider.js';
import type { EvaluationMode } from '../../shared/types/enums.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import { routeAndEvaluate } from '../../neuro-symbolic-router/index.js';
import { disposeJudgeProvider, finishJudgeStage, judgeStageNeeded, prepareJudgeStage } from '../../llm-critic/judge-stage.js';
import type { JudgeStageSettings } from '../../llm-critic/judge-stage.js';
import type { CassetteLLMProvider } from '../../llm-critic/cassette-provider.js';
import { toPipelineError, toPipelineWarning } from './map-helpers.js';

export class RouteEvaluateCommand implements PipelineCommand {
  readonly name = 'route-evaluate';

  constructor(
    private readonly graphRepository: GraphRepository,
    private readonly llmProvider: LLMProvider,
    private readonly evaluationMode: EvaluationMode,
    // U4 C9 hunk (D-U4-7, D-U4-8): judge stage settings; absent → the router runs with the critic defaults
    private readonly judge?: JudgeStageSettings,
  ) {}

  async execute(context: FirewallContext): Promise<DomainResultType<void>> {
    // U4 C9 hunk (ISO-05): the C14 neutral cwd is removed on every path, early failures included
    try {
      return await this.run(context);
    } finally {
      disposeJudgeProvider(this.llmProvider);
    }
  }

  private async run(context: FirewallContext): Promise<DomainResultType<void>> {
    const compiledFunctions = context.getCompiledFunctions();

    // U4 C9 hunk: provider wrapped once (record-mode C14 pre-flight), baseline selections read,
    // critic options from the parsed spec; a failure is a configuration error (exit 2). A run with
    // no neural work (no neuronal instruction, no hybrid pair) skips the stage: no pre-flight, and
    // the report carries the no-judge provenance.
    let llmProvider = this.llmProvider;
    let judgeOptions: Partial<Parameters<typeof routeAndEvaluate>[0]> = {};
    let judged: CassetteLLMProvider | undefined; // set only when this execution prepared the stage
    if (this.judge !== undefined && !judgeStageNeeded(compiledFunctions, this.evaluationMode)) {
      judgeOptions = { projectRoot: this.judge.projectRoot, knownSecrets: this.judge.knownSecrets };
    } else if (this.judge !== undefined) {
      const prepared = await prepareJudgeStage(this.llmProvider, this.judge, context.getParsedSpec());
      if (!prepared.success) {
        return DomainResult.fail(prepared.errors.map((e) => toPipelineError(e, this.name, true)));
      }
      llmProvider = prepared.data.provider;
      judged = prepared.data.provider;
      judgeOptions = {
        projectRoot: this.judge.projectRoot,
        neuronalOptions: prepared.data.options,
        excludePaths: prepared.data.excludePaths,
        knownSecrets: this.judge.knownSecrets,
      };
    }

    const result = await routeAndEvaluate({
      compiledFunctions,
      mode: this.evaluationMode,
      graphRepository: this.graphRepository,
      llmProvider,
      ...judgeOptions,
    });

    if (!result.success) {
      return DomainResult.fail<void>(
        result.errors.map((e) => toPipelineError(e, this.name, true)),
      );
    }

    if (result.warnings) {
      for (const w of result.warnings) {
        context.addWarning(toPipelineWarning(w, this.name));
      }
    }

    // U4 C9 hunk: an incomplete judge run writes its manifest and stops (exit 3, no report, BR-U4-AGG-03)
    if (this.judge !== undefined && judged !== undefined) {
      const finished = finishJudgeStage(this.judge, judged, {
        ...(result.data.neuralOutput !== undefined && { output: result.data.neuralOutput }),
        completeness: result.data.neuralCompleteness,
        ...(result.data.neuralManifest !== undefined && { manifest: result.data.neuralManifest }),
      });
      if (!finished.success) {
        return DomainResult.fail(finished.errors.map((e) => toPipelineError(e, this.name, true)));
      }
      for (const w of finished.warnings ?? []) context.addWarning(toPipelineWarning(w, this.name)); // CAS-10
    }

    // Both failure lists are forwarded (FR-13, BR-U4-AGG-06)
    const { symbolicResults, neuronalResults, failures } = result.data;
    context.setEvaluationResults({ symbolicResults, neuronalResults, failures });

    context.addAuditEntry({
      timestamp: new Date().toISOString(),
      stage: this.name,
      event: `Routed evaluation (mode=${this.evaluationMode}): ${result.data.symbolicResults.length} symbolic + ${result.data.neuronalResults.length} neuronal results, ${String(failures.length)} failed`,
    });

    return DomainResult.ok(undefined);
  }
}
