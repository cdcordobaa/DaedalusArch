import type { PipelineCommand } from '../../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../../shared/context/firewall-context.js';
import type { DomainResult as DomainResultType } from '../../shared/errors/domain-result.js';
import type { BaselineResult } from '../../shared/types/baseline.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import { loadBaseline, compareBaseline } from '../../baseline/index.js';

/**
 * Shared mutable state to pass baseline result between commands.
 * Similar pattern to SharedSnapshotState in snapshot-load-command.
 */
export interface SharedBaselineState {
  baselineResult?: BaselineResult;
}

export class CompareBaselineCommand implements PipelineCommand {
  readonly name = 'compare-baseline';

  constructor(
    private readonly baselineFilePath: string,
    private readonly sharedState: SharedBaselineState,
  ) {}

  async execute(context: FirewallContext): Promise<DomainResultType<void>> {
    const loadResult = loadBaseline(this.baselineFilePath);
    if (!loadResult.success) {
      return DomainResult.fail<void>(
        loadResult.errors.map((e) => ({
          code: e.code,
          message: e.message,
          stage: this.name,
          critical: true,
        })),
      );
    }

    const baseline = loadResult.data;
    const report = context.getReport();
    const result = compareBaseline(report.violations, baseline, this.baselineFilePath);

    this.sharedState.baselineResult = result;

    context.addAuditEntry({
      timestamp: new Date().toISOString(),
      stage: this.name,
      event: `Baseline comparison: ${result.baselineViolations.length} baseline, ${result.newViolations.length} new, ${result.removedFromBaseline.length} fixed`,
      metadata: {
        baselineCount: result.baselineViolations.length,
        newCount: result.newViolations.length,
        removedCount: result.removedFromBaseline.length,
        baselineFile: this.baselineFilePath,
      },
    });

    return DomainResult.ok(undefined);
  }
}
