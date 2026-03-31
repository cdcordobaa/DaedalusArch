import type { PipelineCommand } from '../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../shared/context/firewall-context.js';
import type { DomainResult as DomainResultType, PipelineError } from '../shared/errors/domain-result.js';
import type { EvaluationReport } from '../shared/types/evaluation.js';
import type { StageTimingEntry, StageTimings } from './types.js';
import { DomainResult } from '../shared/errors/domain-result.js';

/**
 * Executes a sequence of PipelineCommand instances against a shared FirewallContext.
 *
 * Behaviour:
 * - Runs commands sequentially in insertion order.
 * - Fail-fast: the first command that returns `success: false` stops the pipeline.
 * - Graceful shutdown: calling `requestShutdown()` causes the next loop iteration
 *   to abort with a PIPELINE_SHUTDOWN error.
 * - Audit entries are written to the context at the start and end of every command.
 * - Timing data is accumulated and retrievable via `getTimings()`.
 * - After all commands succeed, reads the EvaluationReport from the context.
 */
export class PipelineExecutor {
  private readonly timings: StageTimingEntry[] = [];
  private shutdownRequested = false;

  constructor(
    private readonly commands: readonly PipelineCommand[],
    private readonly context: FirewallContext,
  ) {}

  /**
   * Run every command in sequence. Returns the final EvaluationReport on
   * success, or the first critical error encountered.
   */
  async execute(): Promise<DomainResultType<EvaluationReport>> {
    for (const command of this.commands) {
      // --- Shutdown guard ---------------------------------------------------
      if (this.shutdownRequested) {
        const shutdownError: PipelineError = {
          code: 'PIPELINE_SHUTDOWN',
          message: `Pipeline shutdown requested before "${command.name}"`,
          stage: command.name,
          critical: true,
        };
        return DomainResult.fail<EvaluationReport>([shutdownError]);
      }

      // --- Audit: start -----------------------------------------------------
      const start = Date.now();
      this.context.addAuditEntry({
        timestamp: new Date().toISOString(),
        stage: command.name,
        event: 'start',
      });

      // --- Execute ----------------------------------------------------------
      let result: DomainResultType<void>;
      try {
        result = await command.execute(this.context);
      } catch (err) {
        const durationMs = Date.now() - start;
        this.timings.push({ name: command.name, durationMs, status: 'error' });
        this.context.addAuditEntry({
          timestamp: new Date().toISOString(),
          stage: command.name,
          event: 'error',
          durationMs,
          metadata: { thrown: err instanceof Error ? err.message : String(err) },
        });
        const thrownError: PipelineError = {
          code: 'STAGE_THREW',
          message: `Stage "${command.name}" threw: ${err instanceof Error ? err.message : String(err)}`,
          stage: command.name,
          critical: true,
        };
        return DomainResult.fail<EvaluationReport>([thrownError]);
      }

      const durationMs = Date.now() - start;

      // --- Handle failure ---------------------------------------------------
      if (!result.success) {
        this.timings.push({ name: command.name, durationMs, status: 'error' });
        this.context.addAuditEntry({
          timestamp: new Date().toISOString(),
          stage: command.name,
          event: 'error',
          durationMs,
          metadata: { errors: result.errors },
        });
        return DomainResult.fail<EvaluationReport>(result.errors);
      }

      // --- Handle success (with possible warnings) --------------------------
      const hasWarnings = result.warnings !== undefined && result.warnings.length > 0;
      this.timings.push({
        name: command.name,
        durationMs,
        status: hasWarnings ? 'warning' : 'success',
      });
      this.context.addAuditEntry({
        timestamp: new Date().toISOString(),
        stage: command.name,
        event: 'complete',
        durationMs,
      });
    }

    // --- All commands succeeded — extract final report ----------------------
    try {
      const report = this.context.getReport();
      return DomainResult.ok(report);
    } catch {
      const noReportError: PipelineError = {
        code: 'PIPELINE_NO_REPORT',
        message: 'Pipeline completed but no EvaluationReport was set on context',
        stage: 'pipeline-executor',
        critical: true,
      };
      return DomainResult.fail<EvaluationReport>([noReportError]);
    }
  }

  /**
   * Returns accumulated stage timings and a total duration.
   * Safe to call during or after execution.
   */
  getTimings(): StageTimings {
    const totalMs = this.timings.reduce((sum, t) => sum + t.durationMs, 0);
    return { stages: [...this.timings], totalMs };
  }

  /**
   * Request a graceful shutdown. The pipeline will stop before the
   * *next* command — the currently running command will finish.
   */
  requestShutdown(): void {
    this.shutdownRequested = true;
  }
}
