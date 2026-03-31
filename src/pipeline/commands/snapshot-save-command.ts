import type { PipelineCommand } from '../../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../../shared/context/firewall-context.js';
import type { DomainResult as DomainResultType } from '../../shared/errors/domain-result.js';
import type { SnapshotStore } from '../../shared/interfaces/snapshot-store.js';
import type { CommitSha } from '../../shared/types/value-objects.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import { toPipelineError } from './map-helpers.js';

export class SnapshotSaveCommand implements PipelineCommand {
  readonly name = 'snapshot-save';

  constructor(
    private readonly snapshotStore: SnapshotStore,
    private readonly commitSha: CommitSha,
    private readonly projectPath: string,
  ) {}

  async execute(context: FirewallContext): Promise<DomainResultType<void>> {
    const apgResult = context.getApgResult();

    const metadata = {
      commitSha: this.commitSha,
      timestamp: new Date().toISOString(),
      projectPath: this.projectPath,
      nodeCount: apgResult.nodes.length,
      edgeCount: apgResult.edges.length,
    };

    const result = await this.snapshotStore.saveSnapshot(
      this.commitSha,
      apgResult,
      metadata,
    );

    if (!result.success) {
      return DomainResult.fail<void>(
        result.errors.map((e) => toPipelineError(e, this.name, false)),
      );
    }

    context.addAuditEntry({
      timestamp: new Date().toISOString(),
      stage: this.name,
      event: `Snapshot saved for commit ${this.commitSha}: ${apgResult.nodes.length} nodes, ${apgResult.edges.length} edges`,
    });

    return DomainResult.ok(undefined);
  }
}
