/**
 * U2 Step 15: node and edge properties written, per-type graph counts
 * (FR-10, FR-14, FR-21, FR-34; BR-U2-31, 32, 34, 38).
 * U2 Step 16: ensureIndexes and batch count checks (FR-09; BR-U2-33, 35; S-7).
 */
import * as os from 'node:os';
import { ensureIndexes, ingestNodes, ingestEdges, verifyIngestion } from '../../../src/neo4j-ingestion/graph-ingester.js';
import { ingestAPG } from '../../../src/neo4j-ingestion/neo4j-ingestion.js';
import { FileSystemSnapshotStore } from '../../../src/neo4j-ingestion/fs-snapshot-store.js';
import { WRITE_QUERY_TIMEOUT_MS } from '../../../src/neo4j-ingestion/types.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { NODE_TYPES, EDGE_TYPES } from '../../../src/shared/types/enums.js';
import type { GraphRepository, QueryOptions, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import type { APGEdge, APGNode } from '../../../src/shared/types/apg.js';
import type { LayerAnnotation } from '../../../src/neo4j-ingestion/types.js';

interface Call {
  readonly cypher: string;
  readonly params: Record<string, unknown> | undefined;
  readonly options: QueryOptions | undefined;
}

function mockRepo(
  answer: (cypher: string) => readonly Record<string, unknown>[] = () => [],
  counters: (cypher: string, params?: Record<string, unknown>) => Record<string, number> = () => ({}),
  failOn?: string,
): GraphRepository & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    executeQuery(cypher: string, params?: Record<string, unknown>, options?: QueryOptions): Promise<DomainResult<QueryResult>> {
      calls.push({ cypher, params, options });
      if (failOn !== undefined && cypher.includes(failOn)) {
        return Promise.resolve(DomainResult.fail([{ code: 'Neo.ClientError.Schema.IndexFailed', message: `failed: ${failOn}` }]));
      }
      return Promise.resolve(DomainResult.ok({ records: answer(cypher), summary: { counters: counters(cypher, params) } }));
    },
    clearGraph() { return Promise.resolve(DomainResult.ok(undefined)); },
    healthCheck() { return Promise.resolve(true); },
    close() { return Promise.resolve(); },
  };
}

function batchOf(call: Call | undefined): Record<string, unknown>[] {
  return (call?.params?.batch as Record<string, unknown>[] | undefined) ?? [];
}

const NODES: APGNode[] = [
  { id: 'f1', type: 'File', name: 'a.ts', filePath: 'src/a.ts', decorators: [], properties: { name: 'x', id: 'evil', isBarrel: false } },
  { id: 'c1', type: 'Class', name: 'A', filePath: 'src/a.ts', decorators: ['Injectable'], properties: { isAbstract: false, typeParameters: ['T'] } },
  { id: 'p1', type: 'Package', name: 'express', filePath: '', decorators: [], properties: { scope: 'external' } },
];

const ANNOTATIONS: ReadonlyMap<string, LayerAnnotation> = new Map([
  ['f1', { layer: 'domain', role: 'entity', matchMethod: 'directory' }],
]);

const IMPORT_PROPS = {
  specifier: './b', specifiers: ['./b'], line: 3, lines: [3, 7], isTypeOnly: false, importedNames: ['B', 'C'],
};

const EDGES: APGEdge[] = [
  { id: 'e1', type: 'IMPORTS', sourceId: 'f1', targetId: 'f2', properties: IMPORT_PROPS },
  { id: 'e2', type: 'CALLS', sourceId: 'm1', targetId: 'm2', properties: { callCount: 2 } },
  { id: 'e3', type: 'FLOWS_TO', sourceId: 'c1', targetId: 'c2', properties: { field: 'repo', via: 'new', line: 4 } },
  { id: 'e4', type: 'DECLARES', sourceId: 'f1', targetId: 'c1', properties: {} },
];

describe('ingestNodes batch items (BR-U2-31)', () => {
  it('reserved keys win over same-named properties', async () => {
    const repo = mockRepo();
    const result = await ingestNodes(NODES, ANNOTATIONS, repo);
    expect(result).toEqual({ success: true, data: 3 });
    const file = batchOf(repo.calls[0])[0];
    expect(file).toEqual({ isBarrel: false, id: 'f1', type: 'File', name: 'a.ts', filePath: 'src/a.ts', layer: 'domain', role: 'entity' });
  });

  it('writes no decorators key', async () => {
    const repo = mockRepo();
    await ingestNodes(NODES, ANNOTATIONS, repo);
    for (const call of repo.calls) {
      for (const item of batchOf(call)) expect(item).not.toHaveProperty('decorators');
    }
  });

  it('writes Package nodes with their properties and null layer/role', async () => {
    const repo = mockRepo();
    await ingestNodes(NODES, ANNOTATIONS, repo);
    const pkgCall = repo.calls.find((c) => c.cypher.includes('APGNode:Package'));
    expect(batchOf(pkgCall)).toEqual([{ scope: 'external', id: 'p1', type: 'Package', name: 'express', filePath: '', layer: null, role: null }]);
  });

  it('passes the write timeout on every call (BR-U2-38)', async () => {
    const repo = mockRepo();
    await ingestNodes(NODES, ANNOTATIONS, repo);
    expect(repo.calls).toHaveLength(3);
    for (const call of repo.calls) expect(call.options).toEqual({ timeoutMs: WRITE_QUERY_TIMEOUT_MS });
  });
});

describe('ingestEdges batch items (BR-U2-32)', () => {
  it('IMPORTS carries the six FR-10 properties plus id, and SET r = edge.props', async () => {
    const repo = mockRepo();
    const result = await ingestEdges(EDGES, repo);
    expect(result).toEqual({ success: true, data: 4 });
    const call = repo.calls.find((c) => c.cypher.includes('[r:IMPORTS]'));
    expect(call?.cypher).toContain('CREATE (src)-[r:IMPORTS]->(tgt)');
    expect(call?.cypher).toContain('SET r = edge.props');
    expect(batchOf(call)).toEqual([{ sourceId: 'f1', targetId: 'f2', props: { ...IMPORT_PROPS, id: 'e1' } }]);
  });

  it('CALLS carries callCount and FLOWS_TO its three properties', async () => {
    const repo = mockRepo();
    await ingestEdges(EDGES, repo);
    const calls = repo.calls.find((c) => c.cypher.includes('[r:CALLS]'));
    expect(batchOf(calls)[0]?.props).toEqual({ callCount: 2, id: 'e2' });
    const flows = repo.calls.find((c) => c.cypher.includes('[r:FLOWS_TO]'));
    expect(batchOf(flows)[0]?.props).toEqual({ field: 'repo', via: 'new', line: 4, id: 'e3' });
  });

  it('an edge without properties writes only its id, never its type', async () => {
    const repo = mockRepo();
    await ingestEdges(EDGES, repo);
    const declares = repo.calls.find((c) => c.cypher.includes('[r:DECLARES]'));
    expect(batchOf(declares)).toEqual([{ sourceId: 'f1', targetId: 'c1', props: { id: 'e4' } }]);
  });

  it('passes the write timeout on every call (BR-U2-38)', async () => {
    const repo = mockRepo();
    await ingestEdges(EDGES, repo);
    expect(repo.calls).toHaveLength(4);
    for (const call of repo.calls) expect(call.options).toEqual({ timeoutMs: WRITE_QUERY_TIMEOUT_MS });
  });
});

describe('verifyIngestion per-type counts (BR-U2-34)', () => {
  // A Neo4j Integer-like value: Number() reads valueOf().
  const int = (n: number): { valueOf(): number } => ({ valueOf: () => n });

  function answer(cypher: string): readonly Record<string, unknown>[] {
    if (cypher.includes('RETURN count(n) AS cnt')) return [{ cnt: int(5) }];
    if (cypher.includes('RETURN count(r) AS cnt')) return [{ cnt: int(4) }];
    if (cypher.includes('n.type AS type')) return [{ type: 'Package', cnt: int(2) }, { type: 'File', cnt: int(3) }];
    if (cypher.includes('type(r) AS type')) return [{ type: 'IMPORTS', cnt: int(4) }];
    return [];
  }

  it('fills every NODE_TYPES and EDGE_TYPES key in enum order, zeros included', async () => {
    const repo = mockRepo(answer);
    const result = await verifyIngestion(repo, 3, 3);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const { nodeCount, edgeCount, layerCoverage, nodeCountByType, edgeCountByType } = result.data;
    expect({ nodeCount, edgeCount, layerCoverage }).toEqual({ nodeCount: 5, edgeCount: 4, layerCoverage: 1 });
    expect(Object.keys(nodeCountByType)).toEqual([...NODE_TYPES]);
    expect(Object.keys(edgeCountByType)).toEqual([...EDGE_TYPES]);
    expect(nodeCountByType).toEqual({ File: 3, Class: 0, Interface: 0, Method: 0, Function: 0, Package: 2 });
    expect(edgeCountByType.IMPORTS).toBe(4);
    expect(Object.values(edgeCountByType).reduce((a, b) => a + b, 0)).toBe(4);
    expect(typeof nodeCountByType.File).toBe('number');
  });

  it('issues the two per-type queries after the unchanged totals, with the default timeout', async () => {
    const repo = mockRepo(answer);
    await verifyIngestion(repo, 0, 0);
    expect(repo.calls.map((c) => c.cypher)).toEqual([
      'MATCH (n:APGNode) RETURN count(n) AS cnt',
      'MATCH ()-[r]->() RETURN count(r) AS cnt',
      'MATCH (n:APGNode) RETURN n.type AS type, count(*) AS cnt',
      'MATCH ()-[r]->() RETURN type(r) AS type, count(*) AS cnt',
    ]);
    for (const call of repo.calls) expect(call.options).toBeUndefined();
  });

  it('an empty graph gives all-zero maps', async () => {
    const repo = mockRepo();
    const result = await verifyIngestion(repo, 0, 0);
    if (!result.success) throw new Error('expected success');
    expect(Object.values(result.data.nodeCountByType).every((v) => v === 0)).toBe(true);
    expect(Object.keys(result.data.edgeCountByType)).toHaveLength(EDGE_TYPES.length);
  });
});

describe('ensureIndexes (BR-U2-33)', () => {
  it('issues the three statements in order, each with the write timeout', async () => {
    const repo = mockRepo();
    const result = await ensureIndexes(repo);
    expect(result.success).toBe(true);
    expect(repo.calls.map((c) => c.cypher)).toEqual([
      'CREATE INDEX apg_node_id IF NOT EXISTS FOR (n:APGNode) ON (n.id)',
      'CREATE INDEX package_id IF NOT EXISTS FOR (n:Package) ON (n.id)',
      'CALL db.awaitIndexes()',
    ]);
    for (const call of repo.calls) expect(call.options).toEqual({ timeoutMs: WRITE_QUERY_TIMEOUT_MS });
  });

  it('stops at the first failing statement', async () => {
    const repo = mockRepo(undefined, undefined, 'apg_node_id');
    const result = await ensureIndexes(repo);
    expect(result.success).toBe(false);
    expect(repo.calls).toHaveLength(1);
  });
});

describe('ingestAPG sequence with indexes (BR-U2-33)', () => {
  const store = new FileSystemSnapshotStore(os.tmpdir()); // stateless mode never touches it
  const input = {
    apgResult: {
      nodes: NODES, edges: [] as APGEdge[], warnings: [],
      parseCoverage: { total: 1, parsed: 1, skipped: [], percentage: 100 },
    },
    layerModel: { layers: [] },
    mode: 'stateless',
  } as unknown as Parameters<typeof ingestAPG>[0];

  it('creates the indexes after clearGraph and before the first node batch', async () => {
    const repo = mockRepo();
    const order: string[] = [];
    const cleared = repo.clearGraph.bind(repo);
    repo.clearGraph = () => { order.push('clearGraph'); return cleared(); };
    const exec = repo.executeQuery.bind(repo);
    repo.executeQuery = (cypher, params, options) => { order.push(cypher.trim().split('\n')[0] ?? ''); return exec(cypher, params, options); };
    const result = await ingestAPG(input, repo, store);
    expect(result.success).toBe(true);
    expect(order.slice(0, 5)).toEqual([
      'clearGraph',
      'CREATE INDEX apg_node_id IF NOT EXISTS FOR (n:APGNode) ON (n.id)',
      'CREATE INDEX package_id IF NOT EXISTS FOR (n:Package) ON (n.id)',
      'CALL db.awaitIndexes()',
      'UNWIND $batch AS node',
    ]);
  });

  it.each(['CREATE INDEX apg_node_id', 'CREATE INDEX package_id', 'db.awaitIndexes()'])(
    'a failing "%s" fails with NEO4J_QUERY_FAILED and ingests nothing', async (failOn) => {
      const repo = mockRepo(undefined, undefined, failOn);
      const result = await ingestAPG(input, repo, store);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0]?.code).toBe('NEO4J_QUERY_FAILED');
        expect(result.errors[0]?.message).toContain(`failed: ${failOn}`);
      }
      expect(repo.calls.some((c) => c.cypher.includes('UNWIND $batch'))).toBe(false);
    });
});

describe('batch count checks (BR-U2-35, S-7)', () => {
  const store = new FileSystemSnapshotStore(os.tmpdir());
  const threeImports: APGEdge[] = ['a', 'b', 'c'].map((t, i) => ({
    id: `i${String(i)}`, type: 'IMPORTS', sourceId: 'f1', targetId: t, properties: IMPORT_PROPS,
  }));
  const twoFiles: APGNode[] = [
    { id: 'f1', type: 'File', name: 'a.ts', filePath: 'src/a.ts', decorators: [], properties: {} },
    { id: 'f2', type: 'File', name: 'b.ts', filePath: 'src/b.ts', decorators: [], properties: {} },
  ];
  const created = (nodes: number, rels: number) => (cypher: string): Record<string, number> =>
    cypher.includes('APGNode:File') ? { nodesCreated: nodes } : cypher.includes('[r:IMPORTS]') ? { relationshipsCreated: rels } : {};

  function inputWith(nodes: APGNode[], edges: APGEdge[]): Parameters<typeof ingestAPG>[0] {
    return {
      apgResult: { nodes, edges, warnings: [], parseCoverage: { total: 2, parsed: 2, skipped: [], percentage: 100 } },
      layerModel: { layers: [] },
      mode: 'stateless',
    } as unknown as Parameters<typeof ingestAPG>[0];
  }

  it('relationshipsCreated 2 of 3 gives one INGEST_003 in the ingestAPG warnings', async () => {
    const result = await ingestAPG(inputWith(twoFiles, threeImports), mockRepo(undefined, created(2, 2)), store);
    expect(result.success).toBe(true);
    expect(result.warnings).toEqual([{ code: 'INGEST_003', message: 'IMPORTS: created 2 of 3 relationships' }]);
  });

  it('nodesCreated 1 of 2 gives one INGEST_002', async () => {
    const result = await ingestAPG(inputWith(twoFiles, []), mockRepo(undefined, created(1, 0)), store);
    expect(result.warnings).toEqual([{ code: 'INGEST_002', message: 'File: created 1 of 2 nodes' }]);
  });

  it('totalCreated sums the counters; a missing key adds the batch size', async () => {
    const nodes = await ingestNodes(twoFiles, new Map(), mockRepo(undefined, created(1, 0)));
    expect(nodes).toEqual({ success: true, data: 1, warnings: [{ code: 'INGEST_002', message: 'File: created 1 of 2 nodes' }] });
    const edges = await ingestEdges(threeImports, mockRepo());
    expect(edges).toEqual({ success: true, data: 3 });
  });

  it('matching counters give no warning', async () => {
    const result = await ingestAPG(inputWith(twoFiles, threeImports), mockRepo(undefined, created(2, 3)), store);
    expect(result.success).toBe(true);
    expect(result.warnings).toBeUndefined();
  });
});
