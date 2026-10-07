import type { APGNode, APGEdge } from '../shared/types/apg.js';
import type { GraphRepository } from '../shared/interfaces/graph-repository.js';
import type { GraphStats } from '../shared/types/evaluation.js';
import type { DomainWarning } from '../shared/errors/domain-result.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import { NODE_TYPES, EDGE_TYPES } from '../shared/types/enums.js';
import type { NodeType, EdgeType } from '../shared/types/enums.js';
import type { LayerAnnotation } from './types.js';

// Ingestion order is preserved from before the enums existed (D-U0-13): templates have no ORDER BY
// until FR-35, so a different insertion order could reorder rows inside a function's results.
const LEGACY_NODE_ORDER: readonly NodeType[] = ['File', 'Class', 'Interface', 'Method', 'Function'];
const LEGACY_EDGE_ORDER: readonly EdgeType[] = [
  'IMPORTS', 'DECLARES', 'CONTAINS', 'EXTENDS', 'IMPLEMENTS', 'CONSTRUCTOR_INJECTS', 'CALLS',
];

/** Node types in ingestion order: the legacy order, then the remaining NODE_TYPES members. */
export const NODE_INGESTION_ORDER: readonly NodeType[] = [
  ...LEGACY_NODE_ORDER,
  ...NODE_TYPES.filter((t) => !LEGACY_NODE_ORDER.includes(t)),
];

/** Edge types in ingestion order: the legacy order, then the remaining EDGE_TYPES members. */
export const EDGE_INGESTION_ORDER: readonly EdgeType[] = [
  ...LEGACY_EDGE_ORDER,
  ...EDGE_TYPES.filter((t) => !LEGACY_EDGE_ORDER.includes(t)),
];

export interface IngestResult {
  readonly graphStats: GraphStats;
  readonly warnings: DomainWarning[];
}

/**
 * Ingest annotated nodes into Neo4j via UNWIND bulk insert.
 */
export async function ingestNodes(
  nodes: readonly APGNode[],
  annotations: ReadonlyMap<string, LayerAnnotation>,
  graphRepo: GraphRepository,
): Promise<DomainResult<number>> {
  let totalCreated = 0;

  for (const type of NODE_INGESTION_ORDER) {
    const typeNodes = nodes.filter((n) => n.type === type);
    if (typeNodes.length === 0) continue;

    const batch = typeNodes.map((n) => {
      const ann = annotations.get(n.id);
      return {
        id: n.id,
        type: n.type,
        name: n.name,
        filePath: n.filePath,
        layer: ann?.layer ?? null,
        role: ann?.role ?? null,
        ...(n.properties ? flattenProperties(n.properties) : {}),
      };
    });

    const cypher = `
      UNWIND $batch AS node
      CREATE (n:APGNode:${type})
      SET n = node
    `;

    const result = await graphRepo.executeQuery(cypher, { batch });
    if (!result.success) {
      return DomainResult.fail(result.errors);
    }
    totalCreated += typeNodes.length;
  }

  return DomainResult.ok(totalCreated);
}

/**
 * Ingest edges into Neo4j via UNWIND bulk insert.
 */
export async function ingestEdges(
  edges: readonly APGEdge[],
  graphRepo: GraphRepository,
): Promise<DomainResult<number>> {
  let totalCreated = 0;

  for (const type of EDGE_INGESTION_ORDER) {
    const typeEdges = edges.filter((e) => e.type === type);
    if (typeEdges.length === 0) continue;

    const batch = typeEdges.map((e) => ({
      sourceId: e.sourceId,
      targetId: e.targetId,
      id: e.id,
      type: e.type,
    }));

    // Neo4j doesn't support dynamic relationship types in UNWIND CREATE,
    // so we use a separate query per edge type
    const cypher = `
      UNWIND $batch AS edge
      MATCH (src:APGNode {id: edge.sourceId})
      MATCH (tgt:APGNode {id: edge.targetId})
      CREATE (src)-[r:${type} {id: edge.id}]->(tgt)
    `;

    const result = await graphRepo.executeQuery(cypher, { batch });
    if (!result.success) {
      return DomainResult.fail(result.errors);
    }
    totalCreated += typeEdges.length;
  }

  return DomainResult.ok(totalCreated);
}

/**
 * Verify ingestion by counting nodes and edges in Neo4j.
 */
export async function verifyIngestion(
  graphRepo: GraphRepository,
  totalFileNodes: number,
  mappedCount: number,
): Promise<DomainResult<GraphStats>> {
  const nodeResult = await graphRepo.executeQuery('MATCH (n:APGNode) RETURN count(n) AS cnt');
  if (!nodeResult.success) return DomainResult.fail(nodeResult.errors);

  const edgeResult = await graphRepo.executeQuery('MATCH ()-[r]->() RETURN count(r) AS cnt');
  if (!edgeResult.success) return DomainResult.fail(edgeResult.errors);

  const nodeCount = Number(nodeResult.data.records[0]?.['cnt'] ?? 0);
  const edgeCount = Number(edgeResult.data.records[0]?.['cnt'] ?? 0);
  const layerCoverage = totalFileNodes > 0 ? mappedCount / totalFileNodes : 1;

  // Per-type counts are filled by U2 (FR-14); empty maps keep U0 behaviour-neutral.
  return DomainResult.ok({ nodeCount, edgeCount, layerCoverage, nodeCountByType: {}, edgeCountByType: {} });
}

function flattenProperties(props: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (Array.isArray(v)) {
      flat[k] = v; // Neo4j supports arrays
    } else if (typeof v === 'object' && v !== null) {
      flat[k] = JSON.stringify(v);
    } else {
      flat[k] = v;
    }
  }
  return flat;
}
