import type { APGNode, APGEdge } from '../shared/types/apg.js';
import type { GraphRepository } from '../shared/interfaces/graph-repository.js';
import type { GraphStats } from '../shared/types/evaluation.js';
import type { DomainWarning } from '../shared/errors/domain-result.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import type { LayerAnnotation } from './types.js';

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
  const nodeTypes = ['File', 'Class', 'Interface', 'Method', 'Function'] as const;
  let totalCreated = 0;

  for (const type of nodeTypes) {
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
  const edgeTypes = ['IMPORTS', 'DECLARES', 'CONTAINS', 'EXTENDS', 'IMPLEMENTS', 'CONSTRUCTOR_INJECTS', 'CALLS'] as const;
  let totalCreated = 0;

  for (const type of edgeTypes) {
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

  return DomainResult.ok({ nodeCount, edgeCount, layerCoverage });
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
