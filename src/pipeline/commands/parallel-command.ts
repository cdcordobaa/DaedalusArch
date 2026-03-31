import type { PipelineCommand } from '../../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../../shared/context/firewall-context.js';
import type { DomainResult as DomainResultType } from '../../shared/errors/domain-result.js';
import type { PipelineError } from '../../shared/errors/domain-result.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import { toPipelineError, toPipelineWarning } from './map-helpers.js';

export class ParallelCommand implements PipelineCommand {
  readonly name: string;

  constructor(private readonly commands: readonly PipelineCommand[]) {
    this.name = `parallel:${commands.map((c) => c.name).join('+')}`;
  }

  async execute(context: FirewallContext): Promise<DomainResultType<void>> {
    if (this.commands.length === 0) {
      return DomainResult.ok(undefined);
    }

    const results = await Promise.all(
      this.commands.map((cmd) =>
        cmd.execute(context).catch((err): DomainResultType<void> => {
          const pipelineError: PipelineError = {
            code: 'PARALLEL_COMMAND_THREW',
            message: `Command "${cmd.name}" threw: ${err instanceof Error ? err.message : String(err)}`,
            stage: this.name,
            critical: true,
          };
          return DomainResult.fail<void>([pipelineError]);
        },
        ),
      ),
    );

    // Collect all errors across failed results
    const allErrors: PipelineError[] = [];
    for (const result of results) {
      if (!result.success) {
        for (const error of result.errors) {
          allErrors.push(toPipelineError(error, (error as PipelineError).stage ?? this.name, (error as PipelineError).critical ?? true));
        }
      }
    }

    if (allErrors.length > 0) {
      return DomainResult.fail(allErrors);
    }

    // Merge warnings from successful results into context
    for (const result of results) {
      if (result.success && result.warnings) {
        for (const w of result.warnings) {
          context.addWarning(toPipelineWarning(w, this.name));
        }
      }
    }

    return DomainResult.ok(undefined);
  }
}
