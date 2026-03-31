import type { PipelineCommand } from '../../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../../shared/context/firewall-context.js';
import type { DomainResult as DomainResultType } from '../../shared/errors/domain-result.js';
import type { PipelineWarning } from '../../shared/errors/domain-result.js';
import type { DriftThresholds } from '../../shared/types/drift.js';
import type { CommitSha } from '../../shared/types/value-objects.js';
import type { SharedSnapshotState } from './snapshot-load-command.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import { computeDelta, detectDrift } from '../../neo4j-ingestion/index.js';

export class DriftDetectCommand implements PipelineCommand {
  readonly name = 'drift-detect';

  constructor(
    private readonly sharedState: SharedSnapshotState,
    private readonly currentCommitSha: CommitSha,
    private readonly thresholds?: DriftThresholds,
  ) {}

  async execute(context: FirewallContext): Promise<DomainResultType<void>> {
    const previousSnapshot = this.sharedState.previousSnapshot;

    if (!previousSnapshot) {
      context.addAuditEntry({
        timestamp: new Date().toISOString(),
        stage: this.name,
        event: 'Drift detection skipped — no previous snapshot available',
      });
      return DomainResult.ok(undefined);
    }

    const currentApg = context.getApgResult();
    const previousApg = previousSnapshot.apg;

    // Compute structural delta between snapshots
    const delta = computeDelta(currentApg, previousApg);

    // Detect drift using the delta and node/edge comparisons
    const driftReport = detectDrift(
      currentApg.nodes,
      previousApg.nodes,
      currentApg.edges,
      previousApg.edges,
      delta,
      previousSnapshot.metadata.commitSha as string,
      this.currentCommitSha as string,
      undefined, // history — not available from snapshot alone
      this.thresholds,
    );

    // Surface drift alerts as pipeline warnings
    for (const alert of driftReport.alerts) {
      context.addWarning({
        code: `DRIFT_${alert.metric.toUpperCase()}`,
        message: alert.message,
        stage: this.name,
        context: {
          metric: alert.metric,
          severity: alert.severity,
          actualValue: alert.actualValue,
          threshold: alert.threshold,
        },
      } satisfies PipelineWarning);
    }

    context.addAuditEntry({
      timestamp: new Date().toISOString(),
      stage: this.name,
      event: `Drift detection complete (${previousSnapshot.metadata.commitSha} -> ${this.currentCommitSha}): ${driftReport.alerts.length} alerts`,
      metadata: {
        from: driftReport.from,
        to: driftReport.to,
        alertCount: driftReport.alerts.length,
        newCrossLayerDeps: driftReport.structural.newCrossLayerDeps.length,
        overallFanOutDelta: driftReport.coupling.overallFanOutDelta,
      },
    });

    return DomainResult.ok(undefined);
  }
}
