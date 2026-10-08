import type { PipelineCommand } from '../../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../../shared/context/firewall-context.js';
import type { DomainResult as DomainResultType } from '../../shared/errors/domain-result.js';
import type { GraphRepository } from '../../shared/interfaces/graph-repository.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import { evaluateSymbolic } from '../../evaluation-engine/index.js';
import { CYCLE_STRATEGY } from '../../evaluation-engine/scc-cycles.js';
import { toPipelineError, toPipelineWarning } from './map-helpers.js';

export class SymbolicEvaluateCommand implements PipelineCommand {
  readonly name = 'evaluate-symbolic';

  constructor(
    private readonly graphRepository: GraphRepository,
    /** Known secrets scrubbed from failure messages (BR-U3-58). */
    private readonly knownSecrets: readonly string[] = [],
  ) {}

  async execute(context: FirewallContext): Promise<DomainResultType<void>> {
    const compiledFunctions = context.getCompiledFunctions();
    // BR-U3-45: the APG reaches C6 only for the SCC strategy (FF-S02 from the APG); 'cypher' never reads it.
    const apg = CYCLE_STRATEGY === 'scc' ? context.snapshot().apgResult : undefined;

    const result = await evaluateSymbolic({
      queries: compiledFunctions.symbolicQueries,
      graphRepository: this.graphRepository,
      knownSecrets: this.knownSecrets,
      ...(apg !== undefined && { apg }),
    });

    if (!result.success) {
      return DomainResult.fail<void>(
        result.errors.map((e) => toPipelineError(e, this.name, true)),
      );
    }

    // Set evaluation results with symbolic only (empty neuronal); failures forwarded (FR-13, BR-U3-01)
    context.setEvaluationResults({
      symbolicResults: result.data.results,
      neuronalResults: [],
      failures: result.data.failures,
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
      event: `Symbolic evaluation complete: ${passCount}/${result.data.results.length} passed, ${String(result.data.failures.length)} failed to run`,
    });

    return DomainResult.ok(undefined);
  }
}
