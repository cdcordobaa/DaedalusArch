import type { APGNode, APGEdge } from '../shared/types/apg.js';
import type { GraphRepository } from '../shared/interfaces/graph-repository.js';
import type { GraphStats } from '../shared/types/evaluation.js';
import type { DomainWarning } from '../shared/errors/domain-result.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import { NODE_TYPES, EDGE_TYPES } from '../shared/types/enums.js';
import type { NodeType, EdgeType } from '../shared/types/enums.js';
import type { LayerAnnotation } from './types.js';
import { WRITE_QUERY_TIMEOUT_MS } from './types.js';

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

/** Index statements run after `clearGraph`, before node ingestion (FR-09; BR-U2-33). */
export const INDEX_STATEMENTS: readonly string[] = [
  'CREATE INDEX apg_node_id IF NOT EXISTS FOR (n:APGNode) ON (n.id)',
  'CREATE INDEX package_id IF NOT EXISTS FOR (n:Package) ON (n.id)',
  'CALL db.awaitIndexes()',
];

/**
 * Create the APGNode and Package id indexes and wait until they are online. Each statement is its
 * own auto-commit call (schema and writes cannot share a transaction), with the write timeout.
 */
export async function ensureIndexes(graphRepo: GraphRepository): Promise<DomainResult<void>> {
  for (const statement of INDEX_STATEMENTS) {
    const result = await graphRepo.executeQuery(statement, undefined, { timeoutMs: WRITE_QUERY_TIMEOUT_MS });
    if (!result.success) return DomainResult.fail(result.errors);
  }
  return DomainResult.ok(undefined);
}

/**
 * BR-U2-35: compares a batch's created counter with its size. A missing counter key (a mock or a
 * non-Neo4j repository) skips the check and counts the batch size.
 */
function checkCreated(
  counters: Readonly<Record<string, number>>,
  check: { readonly key: 'nodesCreated' | 'relationshipsCreated'; readonly code: 'INGEST_002' | 'INGEST_003'; readonly noun: string },
  type: string,
  batchSize: number,
  warnings: DomainWarning[],
): number {
  if (!(check.key in counters)) return batchSize;
  const created = counters[check.key] ?? 0;
  if (created !== batchSize) {
    warnings.push({ code: check.code, message: `${type}: created ${String(created)} of ${String(batchSize)} ${check.noun}` });
  }
  return created;
}

const NODE_CHECK = { key: 'nodesCreated', code: 'INGEST_002', noun: 'nodes' } as const;
const EDGE_CHECK = { key: 'relationshipsCreated', code: 'INGEST_003', noun: 'relationships' } as const;

/**
 * Ingest annotated nodes into Neo4j via UNWIND bulk insert.
 */
export async function ingestNodes(
  nodes: readonly APGNode[],
  annotations: ReadonlyMap<string, LayerAnnotation>,
  graphRepo: GraphRepository,
): Promise<DomainResult<number>> {
  let totalCreated = 0;
  const warnings: DomainWarning[] = [];

  for (const type of NODE_INGESTION_ORDER) {
    const typeNodes = nodes.filter((n) => n.type === type);
    if (typeNodes.length === 0) continue;

    const batch = typeNodes.map((n) => {
      const ann = annotations.get(n.id);
      // BR-U2-31: reserved keys last, so a same-named entry in `properties` never overrides them;
      // `decorators` are not written.
      return {
        ...(n.properties ? flattenProperties(n.properties) : {}),
        id: n.id,
        type: n.type,
        name: n.name,
        filePath: n.filePath,
        layer: ann?.layer ?? null,
        role: ann?.role ?? null,
      };
    });

    const cypher = `
      UNWIND $batch AS node
      CREATE (n:APGNode:${type})
      SET n = node
    `;

    const result = await graphRepo.executeQuery(cypher, { batch }, { timeoutMs: WRITE_QUERY_TIMEOUT_MS });
    if (!result.success) {
      return DomainResult.fail(result.errors);
    }
    totalCreated += checkCreated(result.data.summary.counters, NODE_CHECK, type, batch.length, warnings);
  }

  return DomainResult.ok(totalCreated, warnings.length > 0 ? warnings : undefined);
}

/**
 * Ingest edges into Neo4j via UNWIND bulk insert.
 */
export async function ingestEdges(
  edges: readonly APGEdge[],
  graphRepo: GraphRepository,
): Promise<DomainResult<number>> {
  let totalCreated = 0;
  const warnings: DomainWarning[] = [];

  for (const type of EDGE_INGESTION_ORDER) {
    const typeEdges = edges.filter((e) => e.type === type);
    if (typeEdges.length === 0) continue;

    // BR-U2-32: every edge type writes its flattened properties plus `id` (FR-10, FR-21, FR-34);
    // `type` is the relationship type and is not stored as a property.
    const batch = typeEdges.map((e) => ({
      sourceId: e.sourceId,
      targetId: e.targetId,
      props: { ...flattenProperties(e.properties), id: e.id },
    }));

    // Neo4j doesn't support dynamic relationship types in UNWIND CREATE,
    // so we use a separate query per edge type
    const cypher = `
      UNWIND $batch AS edge
      MATCH (src:APGNode {id: edge.sourceId})
      MATCH (tgt:APGNode {id: edge.targetId})
      CREATE (src)-[r:${type}]->(tgt)
      SET r = edge.props
    `;

    const result = await graphRepo.executeQuery(cypher, { batch }, { timeoutMs: WRITE_QUERY_TIMEOUT_MS });
    if (!result.success) {
      return DomainResult.fail(result.errors);
    }
    totalCreated += checkCreated(result.data.summary.counters, EDGE_CHECK, type, batch.length, warnings);
  }

  return DomainResult.ok(totalCreated, warnings.length > 0 ? warnings : undefined);
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

  // FR-14, BR-U2-34: per-type counts.
  const nodeTypeResult = await graphRepo.executeQuery('MATCH (n:APGNode) RETURN n.type AS type, count(*) AS cnt');
  if (!nodeTypeResult.success) return DomainResult.fail(nodeTypeResult.errors);

  const edgeTypeResult = await graphRepo.executeQuery('MATCH ()-[r]->() RETURN type(r) AS type, count(*) AS cnt');
  if (!edgeTypeResult.success) return DomainResult.fail(edgeTypeResult.errors);

  const nodeCount = Number(nodeResult.data.records[0]?.['cnt'] ?? 0);
  const edgeCount = Number(edgeResult.data.records[0]?.['cnt'] ?? 0);
  const layerCoverage = totalFileNodes > 0 ? mappedCount / totalFileNodes : 1;
  const nodeCountByType = countsByType(NODE_TYPES, nodeTypeResult.data.records);
  const edgeCountByType = countsByType(EDGE_TYPES, edgeTypeResult.data.records);

  return DomainResult.ok({ nodeCount, edgeCount, layerCoverage, nodeCountByType, edgeCountByType });
}

/** Every key of `types` in enum order, zeros included; `cnt` converted with `Number()` (BR-U2-34). */
function countsByType<T extends string>(
  types: readonly T[],
  records: readonly Record<string, unknown>[],
): Record<T, number> {
  const found = new Map<string, number>();
  for (const record of records) {
    const { type, cnt } = record;
    if (typeof type === 'string') found.set(type, Number(cnt ?? 0));
  }
  const counts = {} as Record<T, number>;
  for (const type of types) {
    counts[type] = found.get(type) ?? 0;
  }
  return counts;
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
