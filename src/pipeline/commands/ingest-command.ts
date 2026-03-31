import type { PipelineCommand } from '../../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../../shared/context/firewall-context.js';
import type { DomainResult as DomainResultType } from '../../shared/errors/domain-result.js';
import type { GraphRepository } from '../../shared/interfaces/graph-repository.js';
import type { SnapshotStore } from '../../shared/interfaces/snapshot-store.js';
import type { PipelineMode } from '../../shared/types/enums.js';
import type { CommitSha } from '../../shared/types/value-objects.js';
import type { DriftThresholds } from '../../shared/types/drift.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import { ingestAPG } from '../../neo4j-ingestion/index.js';
import { toPipelineError, toPipelineWarning } from './map-helpers.js';

export interface IngestCommandConfig {
  readonly mode: PipelineMode;
  readonly commitSha?: CommitSha;
  readonly apgStorePath?: string;
  readonly driftThresholds?: DriftThresholds;
}

export class IngestCommand implements PipelineCommand {
  readonly name = 'ingest-apg';

  constructor(
    private readonly graphRepo: GraphRepository,
    private readonly snapshotStore: SnapshotStore,
    private readonly config: IngestCommandConfig,
  ) {}

  async execute(context: FirewallContext): Promise<DomainResultType<void>> {
    const apgResult = context.getApgResult();
    const parsedSpec = context.getParsedSpec();

    const input = {
      apgResult,
      layerModel: parsedSpec.layerModel,
      mode: this.config.mode,
      ...(this.config.commitSha !== undefined && { commitSha: this.config.commitSha }),
      ...(this.config.apgStorePath !== undefined && { apgStorePath: this.config.apgStorePath }),
      ...(this.config.driftThresholds !== undefined && { driftThresholds: this.config.driftThresholds }),
    };

    const result = await ingestAPG(input, this.graphRepo, this.snapshotStore);

    if (!result.success) {
      return DomainResult.fail<void>(
        result.errors.map((e) => toPipelineError(e, this.name, true)),
      );
    }

    context.setIngestionResult(result.data);

    if (result.warnings) {
      for (const w of result.warnings) {
        context.addWarning(toPipelineWarning(w, this.name));
      }
    }

    const stats = result.data.graphStats;
    context.addAuditEntry({
      timestamp: new Date().toISOString(),
      stage: this.name,
      event: `Ingested APG into graph: ${stats.nodeCount} nodes, ${stats.edgeCount} edges, ${(stats.layerCoverage * 100).toFixed(1)}% layer coverage`,
      metadata: {
        mapped: result.data.layerAnnotationSummary.mapped,
        unmapped: result.data.layerAnnotationSummary.unmapped,
        ...(result.data.deltaStats !== undefined && { deltaStats: result.data.deltaStats }),
      },
    });

    return DomainResult.ok(undefined);
  }
}
