import type { PipelineCommand } from '../../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../../shared/context/firewall-context.js';
import type { DomainResult as DomainResultType } from '../../shared/errors/domain-result.js';
import type { SnapshotStore, Snapshot } from '../../shared/interfaces/snapshot-store.js';
import type { CommitSha } from '../../shared/types/value-objects.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import { toPipelineError } from './map-helpers.js';

/**
 * Shared state reference for passing the loaded snapshot between
 * SnapshotLoadCommand and DriftDetectCommand via constructor injection.
 */
export interface SharedSnapshotState {
  previousSnapshot?: Snapshot;
}

export class SnapshotLoadCommand implements PipelineCommand {
  readonly name = 'snapshot-load';

  constructor(
    private readonly snapshotStore: SnapshotStore,
    private readonly sharedState: SharedSnapshotState,
    private readonly fromSha?: CommitSha,
  ) {}

  async execute(context: FirewallContext): Promise<DomainResultType<void>> {
    const result = this.fromSha !== undefined
      ? await this.snapshotStore.loadSnapshot(this.fromSha)
      : await this.snapshotStore.getLatestSnapshot();

    if (!result.success) {
      return DomainResult.fail<void>(
        result.errors.map((e) => toPipelineError(e, this.name, false)),
      );
    }

    if (result.data === null) {
      context.addAuditEntry({
        timestamp: new Date().toISOString(),
        stage: this.name,
        event: this.fromSha !== undefined
          ? `No snapshot found for commit ${this.fromSha}`
          : 'No previous snapshot found — first run',
      });
      return DomainResult.ok(undefined);
    }

    this.sharedState.previousSnapshot = result.data;

    context.addAuditEntry({
      timestamp: new Date().toISOString(),
      stage: this.name,
      event: `Loaded snapshot for commit ${result.data.metadata.commitSha}: ${result.data.apg.nodes.length} nodes, ${result.data.apg.edges.length} edges`,
    });

    return DomainResult.ok(undefined);
  }
}
