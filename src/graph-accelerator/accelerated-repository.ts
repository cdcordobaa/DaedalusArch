/**
 * A `GraphRepository` decorator that answers the bounded cycle queries in memory (Docs/v1.3/scale.md §3).
 *
 * Every query goes to the wrapped repository (Neo4j) unchanged, except a recognised cycle query
 * (`cycle-queries.ts`) while the graph mirror is valid and the query is inside the in-memory guards. The ingestion
 * writes still run on Neo4j first; the mirror only follows them (`graph-mirror.ts`). The decorator never changes
 * the text, the parameters, the timeout or the result of a query it forwards.
 */
import type { GraphRepository, QueryOptions, QueryResult } from '../shared/interfaces/graph-repository.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import { GraphMirror, changesData, recogniseWrite } from './graph-mirror.js';
import { answer, recogniseQuery } from './cycle-queries.js';
import type { AcceleratedQuery } from './cycle-queries.js';

/** The counters a read query returns from Neo4j (`summary.counters.updates()`): every key, all zero. */
const READ_COUNTERS: Readonly<Record<string, number>> = Object.freeze({
  nodesCreated: 0, nodesDeleted: 0, relationshipsCreated: 0, relationshipsDeleted: 0, propertiesSet: 0, labelsAdded: 0,
  labelsRemoved: 0, indexesAdded: 0, indexesRemoved: 0, constraintsAdded: 0, constraintsRemoved: 0,
});

export interface AccelerationEvent {
  readonly query: AcceleratedQuery;
  /** `memory` when answered in memory, `neo4j` when handed back (mirror not valid, or outside the guards). */
  readonly engine: 'memory' | 'neo4j';
  readonly durationMs: number;
}

export class AcceleratedGraphRepository implements GraphRepository {
  readonly mirror = new GraphMirror();

  constructor(
    private readonly inner: GraphRepository,
    private readonly onEvent?: (event: AccelerationEvent) => void,
  ) {}

  async executeQuery(cypher: string, params?: Record<string, unknown>, options?: QueryOptions): Promise<DomainResult<QueryResult>> {
    const write = recogniseWrite(cypher);
    if (write !== undefined) {
      const result = await this.inner.executeQuery(cypher, params, options);
      if (result.success) this.mirror.applyWrite(write, params, result.data.summary.counters);
      else this.mirror.invalidate();
      return result;
    }
    const query = recogniseQuery(cypher);
    if (query !== undefined) {
      const started = performance.now();
      const rows = answer(this.mirror, query, params);
      if (rows !== undefined) {
        this.onEvent?.({ query, engine: 'memory', durationMs: performance.now() - started });
        return DomainResult.ok({ records: rows, summary: { counters: { ...READ_COUNTERS } } });
      }
      this.onEvent?.({ query, engine: 'neo4j', durationMs: performance.now() - started });
    }
    const result = await this.inner.executeQuery(cypher, params, options);
    if (result.success && changesData(result.data.summary.counters)) this.mirror.invalidate();
    return result;
  }

  async clearGraph(): Promise<DomainResult<void>> {
    const result = await this.inner.clearGraph();
    this.mirror.reset(result.success);
    return result;
  }

  healthCheck(): Promise<boolean> {
    return this.inner.healthCheck();
  }

  close(): Promise<void> {
    return this.inner.close();
  }
}
