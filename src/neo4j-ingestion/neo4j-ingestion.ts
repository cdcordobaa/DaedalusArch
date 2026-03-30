import type { IngestionResult } from '../shared/types/evaluation.js';
import type { GraphRepository } from '../shared/interfaces/graph-repository.js';
import type { SnapshotStore } from '../shared/interfaces/snapshot-store.js';
import type { PipelineStage } from '../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../shared/context/firewall-context.js';
import type { DomainWarning } from '../shared/errors/domain-result.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import type { IngestionInput, IngestionError } from './types.js';
import { DEFAULT_DRIFT_THRESHOLDS } from './types.js';
import { annotateNodes } from './layer-annotator.js';
import { ingestNodes, ingestEdges, verifyIngestion } from './graph-ingester.js';
import { computeDelta, computeDeltaStats } from './delta-computer.js';
import { detectDrift } from './drift-detector.js';

/**
 * Full APG ingestion pipeline: annotate → clear → ingest → verify → snapshot → delta → drift
 */
export async function ingestAPG(
  input: IngestionInput,
  graphRepo: GraphRepository,
  snapshotStore: SnapshotStore,
): Promise<DomainResult<IngestionResult>> {
  const warnings: DomainWarning[] = [];
  const thresholds = input.driftThresholds ?? DEFAULT_DRIFT_THRESHOLDS;

  // 1. Annotate nodes with layers
  const { annotations, summary: layerSummary } = annotateNodes(input.apgResult.nodes, input.layerModel);

  // 2. Clear graph (both modes clear before ingestion)
  const clearResult = await graphRepo.clearGraph();
  if (!clearResult.success) {
    return DomainResult.fail<IngestionResult>([ingestionError('NEO4J_QUERY_FAILED', `Failed to clear graph: ${clearResult.errors[0]?.message}`)]);
  }

  // 3. Ingest nodes
  const nodeResult = await ingestNodes(input.apgResult.nodes, annotations, graphRepo);
  if (!nodeResult.success) {
    return DomainResult.fail<IngestionResult>([ingestionError('INGESTION_FAILED', `Node ingestion failed: ${nodeResult.errors[0]?.message}`)]);
  }

  // 4. Ingest edges
  const edgeResult = await ingestEdges(input.apgResult.edges, graphRepo);
  if (!edgeResult.success) {
    return DomainResult.fail<IngestionResult>([ingestionError('INGESTION_FAILED', `Edge ingestion failed: ${edgeResult.errors[0]?.message}`)]);
  }

  // 5. Verify ingestion
  const fileNodeCount = input.apgResult.nodes.filter((n) => n.type === 'File').length;
  const statsResult = await verifyIngestion(graphRepo, fileNodeCount, layerSummary.mapped);
  if (!statsResult.success) {
    return DomainResult.fail<IngestionResult>([ingestionError('NEO4J_QUERY_FAILED', `Verification failed: ${statsResult.errors[0]?.message}`)]);
  }

  const graphStats = statsResult.data;
  let result: IngestionResult = { graphStats, layerAnnotationSummary: layerSummary };

  // 6. Persistent mode: snapshot + delta + drift
  if (input.mode === 'persistent' && input.commitSha) {
    const sha = input.commitSha;

    // Save snapshot
    const snapResult = await snapshotStore.saveSnapshot(sha, input.apgResult, {
      commitSha: sha,
      timestamp: new Date().toISOString(),
      projectPath: '',
      nodeCount: graphStats.nodeCount,
      edgeCount: graphStats.edgeCount,
    });
    if (!snapResult.success) {
      warnings.push({ code: 'SNAPSHOT_WRITE_FAILED', message: `Snapshot save failed: ${snapResult.errors[0]?.message}` });
    }

    // Load previous snapshot for delta
    const prevResult = await snapshotStore.getLatestSnapshot();
    if (prevResult.success && prevResult.data && String(prevResult.data.metadata.commitSha) !== String(sha)) {
      const prev = prevResult.data;

      // Compute delta
      const delta = computeDelta(input.apgResult, prev.apg);
      const deltaStats = computeDeltaStats(delta);

      // Save delta
      await snapshotStore.saveDelta(prev.metadata.commitSha, sha, delta);

      // Detect drift
      const driftReport = detectDrift(
        input.apgResult.nodes, prev.apg.nodes,
        input.apgResult.edges, prev.apg.edges,
        delta,
        String(prev.metadata.commitSha), String(sha),
        undefined, // history — would need multiple snapshots
        thresholds,
      );

      // Save drift report
      await snapshotStore.saveDriftReport(sha, driftReport);

      result = { ...result, deltaStats, driftReport };
    } else {
      warnings.push({ code: 'INGEST_004', message: 'No previous snapshot found, delta/drift skipped' });
    }
  }

  return DomainResult.ok(result, warnings.length > 0 ? warnings : undefined);
}

/**
 * PipelineStage implementation for Neo4j Ingestion.
 */
export class Neo4jIngestionStage implements PipelineStage<IngestionInput, IngestionResult> {
  readonly name = 'neo4j-ingestion';

  constructor(
    private readonly graphRepo: GraphRepository,
    private readonly snapshotStore: SnapshotStore,
  ) {}

  async execute(input: IngestionInput, context: FirewallContext): Promise<DomainResult<IngestionResult>> {
    const start = Date.now();
    const result = await ingestAPG(input, this.graphRepo, this.snapshotStore);

    if (result.success) {
      context.setIngestionResult(result.data);
      context.addAuditEntry({
        timestamp: new Date().toISOString(),
        stage: 'neo4j-ingestion',
        event: 'APG ingested successfully',
        durationMs: Date.now() - start,
        metadata: {
          nodeCount: result.data.graphStats.nodeCount,
          edgeCount: result.data.graphStats.edgeCount,
          layerCoverage: result.data.graphStats.layerCoverage,
          mapped: result.data.layerAnnotationSummary.mapped,
          unmapped: result.data.layerAnnotationSummary.unmapped,
          hasDelta: result.data.deltaStats !== undefined,
          hasDrift: result.data.driftReport !== undefined,
        },
      });
    } else {
      context.addAuditEntry({
        timestamp: new Date().toISOString(),
        stage: 'neo4j-ingestion',
        event: `Ingestion failed: ${result.errors[0]?.message}`,
        durationMs: Date.now() - start,
      });
    }

    return result;
  }
}

function ingestionError(code: IngestionError['code'], message: string): IngestionError {
  return { code, message, stage: 'neo4j-ingestion', critical: true };
}
