/**
 * `GraphRepository` over the in-memory graph, answered by the Cypher interpreter (engine `cypher-interp`).
 *
 * Reads: every query text goes to `parseCypher` + `executeQuery`, exactly as the caller compiled it (edge views,
 * exclude markers and parameters are applied by the pipeline before the text reaches any repository).
 *
 * Writes: the interpreter is read-only. The ingestion's fixed write statements (`graph-ingester.ts`: the wipe, the
 * index statements, one UNWIND-CREATE per node type and per edge type) are recognised by their exact shape and
 * applied to the store with Neo4j's semantics (`SET n = map` drops null entries; an edge whose endpoint id matches no
 * node is not created, and one per matching node pair when ids repeat), and return the same `nodesCreated` /
 * `relationshipsCreated` counters, so `ingestAPG` runs unchanged. Any other write is rejected.
 */
import type { GraphRepository, QueryOptions, QueryResult } from '../shared/interfaces/graph-repository.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import { executeQuery } from './eval.js';
import { MemoryGraph } from './graph.js';
import { CypherSyntaxError, CypherUnsupportedError, parseCypher } from './parse.js';
import { fromDriver, toDriver } from './driver-values.js';
import { CypherMap, CypherRuntimeError } from './values.js';
import type { GraphNode, Value } from './values.js';

const NODE_INGEST = /^\s*UNWIND \$batch AS node\s+CREATE \(n:APGNode:([A-Za-z_][A-Za-z0-9_]*)\)\s+SET n = node\s*$/;
const EDGE_INGEST = /^\s*UNWIND \$batch AS edge\s+MATCH \(src:APGNode \{id: edge\.sourceId\}\)\s+MATCH \(tgt:APGNode \{id: edge\.targetId\}\)\s+CREATE \(src\)-\[r:([A-Za-z_][A-Za-z0-9_]*)\]->\(tgt\)\s+SET r = edge\.props\s*$/;
const NO_OP = [
  /^\s*CREATE INDEX [A-Za-z_]+ IF NOT EXISTS FOR \(n:[A-Za-z_]+\) ON \(n\.[A-Za-z_]+\)\s*$/,
  /^\s*CALL db\.awaitIndexes\(\)\s*$/,
];
const WIPE = /^\s*MATCH \(n\) DETACH DELETE n\s*$/;

const ZERO_COUNTERS = {
  nodesCreated: 0, nodesDeleted: 0, relationshipsCreated: 0, relationshipsDeleted: 0, propertiesSet: 0,
  labelsAdded: 0, labelsRemoved: 0, indexesAdded: 0, indexesRemoved: 0, constraintsAdded: 0, constraintsRemoved: 0,
};

/** `SET x = map`: the map's non-null entries become the properties (Neo4j drops a property set to null). */
function propertiesOf(v: Value): Map<string, Value> {
  if (!(v instanceof CypherMap)) throw new CypherRuntimeError('SET = expects a map');
  const out = new Map<string, Value>();
  for (const [k, x] of v.entries) if (x !== null) out.set(k, x);
  return out;
}

export class MemoryGraphRepository implements GraphRepository {
  readonly graph = new MemoryGraph();
  /** Nodes by their `id` property (the ingestion's `MATCH (:APGNode {id})`), in creation order. */
  private readonly byApgId = new Map<string, GraphNode[]>();

  executeQuery(cypher: string, params?: Record<string, unknown>, _options?: QueryOptions): Promise<DomainResult<QueryResult>> {
    return Promise.resolve(this.run(cypher, params ?? {}));
  }

  private run(cypher: string, params: Record<string, unknown>): DomainResult<QueryResult> {
    try {
      if (WIPE.test(cypher)) {
        const nodesDeleted = this.graph.nodes.length;
        const relationshipsDeleted = this.graph.relationships.length;
        this.graph.clear();
        this.byApgId.clear();
        return DomainResult.ok({ records: [], summary: { counters: { ...ZERO_COUNTERS, nodesDeleted, relationshipsDeleted } } });
      }
      if (NO_OP.some((re) => re.test(cypher))) return DomainResult.ok({ records: [], summary: { counters: { ...ZERO_COUNTERS } } });
      const node = NODE_INGEST.exec(cypher);
      if (node !== null) return DomainResult.ok({ records: [], summary: { counters: this.ingestNodes(node[1] ?? '', params) } });
      const edge = EDGE_INGEST.exec(cypher);
      if (edge !== null) return DomainResult.ok({ records: [], summary: { counters: this.ingestEdges(edge[1] ?? '', params) } });
      const query = parseCypher(cypher);
      const p = new Map<string, Value>(Object.entries(params).map(([k, v]) => [k, fromDriver(v)]));
      const out = executeQuery(query, this.graph, p);
      const records = out.rows.map((row) => {
        const obj: Record<string, unknown> = {};
        out.columns.forEach((c, i) => { obj[c] = toDriver(row[i] ?? null); });
        return obj;
      });
      return DomainResult.ok({ records, summary: { counters: { ...ZERO_COUNTERS } } });
    } catch (e) {
      const code = e instanceof CypherSyntaxError || e instanceof CypherUnsupportedError || e instanceof CypherRuntimeError ? e.code : 'CypherInterp.InternalError';
      return DomainResult.fail([{ code, message: e instanceof Error ? e.message : String(e) }]);
    }
  }

  private ingestNodes(type: string, params: Record<string, unknown>): Record<string, number> {
    const batch = fromDriver(params.batch);
    if (!Array.isArray(batch)) throw new CypherRuntimeError('UNWIND $batch: not a list');
    let propertiesSet = 0;
    for (const item of batch as readonly Value[]) {
      const props = propertiesOf(item);
      propertiesSet += props.size;
      const n = this.graph.createNode(['APGNode', type], props);
      const id = props.get('id');
      if (typeof id === 'string') {
        let list = this.byApgId.get(id);
        if (list === undefined) this.byApgId.set(id, (list = []));
        list.push(n);
      }
    }
    return { ...ZERO_COUNTERS, nodesCreated: batch.length, labelsAdded: 2 * batch.length, propertiesSet };
  }

  private ingestEdges(type: string, params: Record<string, unknown>): Record<string, number> {
    const batch = fromDriver(params.batch);
    if (!Array.isArray(batch)) throw new CypherRuntimeError('UNWIND $batch: not a list');
    let created = 0;
    let propertiesSet = 0;
    for (const item of batch as readonly Value[]) {
      if (!(item instanceof CypherMap)) throw new CypherRuntimeError('edge batch entry is not a map');
      const s = item.entries.get('sourceId') ?? null;
      const t = item.entries.get('targetId') ?? null;
      const srcs = typeof s === 'string' ? this.byApgId.get(s) ?? [] : [];
      const tgts = typeof t === 'string' ? this.byApgId.get(t) ?? [] : [];
      for (const src of srcs) {
        for (const tgt of tgts) {
          const props = propertiesOf(item.entries.get('props') ?? null);
          propertiesSet += props.size;
          this.graph.createRelationship(type, src, tgt, props);
          created += 1;
        }
      }
    }
    return { ...ZERO_COUNTERS, relationshipsCreated: created, propertiesSet };
  }

  async clearGraph(): Promise<DomainResult<void>> {
    const r = await this.executeQuery('MATCH (n) DETACH DELETE n');
    return r.success ? DomainResult.ok(undefined) : DomainResult.fail(r.errors);
  }

  healthCheck(): Promise<boolean> {
    return Promise.resolve(true);
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}
