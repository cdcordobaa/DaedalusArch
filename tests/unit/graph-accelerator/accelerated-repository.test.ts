/**
 * The accelerated repository and its graph mirror (Docs/v1.3/scale.md §3): which queries reach Neo4j, and when the
 * mirror is trusted.
 */
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { AcceleratedGraphRepository } from '../../../src/graph-accelerator/accelerated-repository.js';
import type { AccelerationEvent } from '../../../src/graph-accelerator/accelerated-repository.js';
import { GraphMirror, changesData, recogniseWrite } from '../../../src/graph-accelerator/graph-mirror.js';
import { edgeIngestCypher, ingestEdges, ingestNodes, nodeIngestCypher } from '../../../src/neo4j-ingestion/graph-ingester.js';
import { UNIVERSAL_METRIC_QUERIES } from '../../../src/scoring-engine/universal-metrics.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import { RecordingRepository, apgEdge, apgNode, mirrored } from './helpers.js';

const METRIC = UNIVERSAL_METRIC_QUERIES.cyclicDependencyCount;
const ok = (counters: Record<string, number> = {}): QueryResult => ({ records: [], summary: { counters } });

describe('recogniseWrite', () => {
  it('recognises the ingestion writes byte for byte', () => {
    expect(recogniseWrite(nodeIngestCypher('File'))).toEqual({ kind: 'nodes', label: 'File' });
    expect(recogniseWrite(edgeIngestCypher('RE_EXPORTS'))).toEqual({ kind: 'edges', type: 'RE_EXPORTS' });
    expect(recogniseWrite(`${nodeIngestCypher('File')} `)).toBeUndefined();
    expect(recogniseWrite('MATCH (n) RETURN n')).toBeUndefined();
  });
});

describe('GraphMirror', () => {
  it('is unknown until a clear, valid after a successful clear, invalid after a failed one', () => {
    const m = new GraphMirror();
    expect(m.state).toBe('unknown');
    m.applyWrite({ kind: 'nodes', label: 'File' }, { batch: [{ id: 'a' }] }, {});
    expect(m.nodeCount).toBe(0);
    m.reset(true);
    expect(m.state).toBe('valid');
    m.reset(false);
    expect(m.state).toBe('invalid');
  });

  it('becomes invalid when a counter disagrees with its own count', () => {
    const m = new GraphMirror();
    m.reset(true);
    m.applyWrite({ kind: 'nodes', label: 'File' }, { batch: [{ id: 'a' }, { id: 'b' }] }, { nodesCreated: 2 });
    expect(m.state).toBe('valid');
    m.applyWrite({ kind: 'edges', type: 'IMPORTS' }, { batch: [{ sourceId: 'a', targetId: 'b', props: {} }, { sourceId: 'a', targetId: 'zz', props: {} }] }, { relationshipsCreated: 1 });
    expect(m.state).toBe('valid');
    expect(m.rels).toHaveLength(1);
    m.applyWrite({ kind: 'edges', type: 'IMPORTS' }, { batch: [{ sourceId: 'a', targetId: 'b', props: {} }] }, { relationshipsCreated: 2 });
    expect(m.state).toBe('invalid');
  });

  it('becomes invalid on a node id that is not a string, or a batch that is not a list', () => {
    const m = new GraphMirror();
    m.reset(true);
    m.applyWrite({ kind: 'nodes', label: 'File' }, { batch: [{ id: 7 }] }, {});
    expect(m.state).toBe('invalid');
    m.reset(true);
    m.applyWrite({ kind: 'nodes', label: 'File' }, {}, {});
    expect(m.state).toBe('invalid');
  });

  it('creates one relationship per pair of nodes sharing an id, as the edge MATCH does', () => {
    const m = new GraphMirror();
    m.reset(true);
    m.applyWrite({ kind: 'nodes', label: 'File' }, { batch: [{ id: 'a', filePath: 'x' }, { id: 'a', filePath: 'y' }, { id: 'b' }] }, { nodesCreated: 3 });
    m.applyWrite({ kind: 'edges', type: 'IMPORTS' }, { batch: [{ sourceId: 'a', targetId: 'b', props: { line: 4 } }] }, { relationshipsCreated: 2 });
    expect(m.state).toBe('valid');
    expect(m.rels.map((r) => [r.source, r.target, r.line])).toEqual([[0, 2, 4], [1, 2, 4]]);
    expect(m.filePaths).toEqual(['x', 'y', null]);
  });

  it('counts only data counters as a change', () => {
    expect(changesData({ indexesAdded: 1, nodesCreated: 0 })).toBe(false);
    expect(changesData({ propertiesSet: 1 })).toBe(true);
  });
});

describe('AcceleratedGraphRepository', () => {
  it('answers a recognised query in memory and never sends it to Neo4j', async () => {
    const events: AccelerationEvent[] = [];
    const inner = new RecordingRepository();
    const repo = new AcceleratedGraphRepository(inner, (e) => events.push(e));
    await repo.clearGraph();
    await ingestNodes([apgNode({ id: 'a' }), apgNode({ id: 'b' })], new Map(), repo);
    await ingestEdges([apgEdge({ from: 'a', to: 'b' }, 1), apgEdge({ from: 'b', to: 'a' }, 2)], repo);
    const sent = inner.queries.length;
    const result = await repo.executeQuery(METRIC);
    expect(result.success && Number(result.data.records[0]?.['cnt'])).toBe(2);
    expect(result.success && result.data.summary.counters['nodesCreated']).toBe(0);
    expect(inner.queries).toHaveLength(sent);
    expect(events.map((e) => e.engine)).toEqual(['memory']);
  });

  it('sends a recognised query to Neo4j while the mirror is unknown or invalid', async () => {
    const events: AccelerationEvent[] = [];
    const inner = new RecordingRepository();
    const repo = new AcceleratedGraphRepository(inner, (e) => events.push(e));
    await repo.executeQuery(METRIC);
    expect(inner.queries).toEqual([METRIC]);
    expect(events.map((e) => e.engine)).toEqual(['neo4j']);
  });

  it('invalidates the mirror after another query that changes data, and after a failed write', async () => {
    let counters: Record<string, number> = {};
    const inner = new RecordingRepository(() => ok(counters));
    const repo = new AcceleratedGraphRepository(inner);
    await repo.clearGraph();
    counters = { nodesCreated: 0 };
    await repo.executeQuery('MATCH (n) RETURN count(n)');
    expect(repo.mirror.state).toBe('valid');
    counters = { propertiesSet: 3 };
    await repo.executeQuery('MATCH (n) SET n.x = 1');
    expect(repo.mirror.state).toBe('invalid');

    const failing: GraphRepository = {
      executeQuery: async () => DomainResult.fail([{ code: 'X', message: 'boom' }]),
      clearGraph: async () => DomainResult.ok(undefined),
      healthCheck: async () => true,
      close: async () => {},
    };
    const repo2 = new AcceleratedGraphRepository(failing);
    await repo2.clearGraph();
    await repo2.executeQuery(nodeIngestCypher('File'), { batch: [{ id: 'a' }] });
    expect(repo2.mirror.state).toBe('invalid');
  });

  it('forwards every other query unchanged, with its parameters and timeout', async () => {
    const seen: unknown[] = [];
    const inner: GraphRepository = {
      executeQuery: async (cypher, params, options) => {
        seen.push([cypher, params, options]);
        return DomainResult.ok(ok());
      },
      clearGraph: async () => DomainResult.ok(undefined),
      healthCheck: async () => true,
      close: async () => {},
    };
    const repo = new AcceleratedGraphRepository(inner);
    await repo.executeQuery('MATCH (n) RETURN n', { a: 1 }, { timeoutMs: 5 });
    expect(seen).toEqual([['MATCH (n) RETURN n', { a: 1 }, { timeoutMs: 5 }]]);
  });

  it('builds a valid mirror through the real ingestion functions', async () => {
    const repo = await mirrored([{ id: 'a' }, { id: 'b' }], [{ from: 'a', to: 'b', line: 3, viaReExport: false }]);
    expect(repo.mirror.state).toBe('valid');
    expect(repo.mirror.rels).toEqual([{ type: 'IMPORTS', source: 0, target: 1, line: 3, viaReExport: false }]);
  });
});
