import neo4j, { type Driver, type Session } from 'neo4j-driver';
import type { GraphRepository, QueryOptions, QueryResult } from '../shared/interfaces/graph-repository.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import type { IngestionConfig, Neo4jRepositoryConfig } from './types.js';
import { DEFAULT_INGESTION_CONFIG, WRITE_QUERY_TIMEOUT_MS } from './types.js';

export class Neo4jRepository implements GraphRepository {
  private readonly cfg: IngestionConfig;
  /** Created lazily by the first query (BR-U2-41); the constructor never touches the driver. */
  private driver: Driver | undefined;

  constructor(config: Neo4jRepositoryConfig) {
    this.cfg = { ...DEFAULT_INGESTION_CONFIG, ...config };
  }

  async executeQuery(
    cypher: string,
    params?: Record<string, unknown>,
    options?: QueryOptions,
  ): Promise<DomainResult<QueryResult>> {
    let session: Session | undefined;
    try {
      // Synchronous, before the first await: concurrent first calls share one driver (BR-U2-41).
      this.driver ??= neo4j.driver(this.cfg.neo4jUri, neo4j.auth.basic(this.cfg.neo4jUser, this.cfg.neo4jPassword));
      session = this.driver.session();
      // BR-U2-38: a timeout is always passed; the config default applies when the caller gives none.
      const timeout = options?.timeoutMs ?? this.cfg.queryTimeoutMs;
      const result = await session.run(cypher, params, { timeout });
      const records = result.records.map((r) => {
        const obj: Record<string, unknown> = {};
        for (const key of r.keys as string[]) {
          obj[key] = r.get(key);
        }
        return obj;
      });
      const counters: Record<string, number> = {};
      const stats = result.summary.counters.updates() as Record<string, unknown>;
      for (const [k, v] of Object.entries(stats)) {
        counters[k] = Number(v);
      }
      return DomainResult.ok({ records, summary: { counters } });
    } catch (e) {
      return DomainResult.fromError(e);
    } finally {
      if (session) await session.close();
    }
  }

  async clearGraph(): Promise<DomainResult<void>> {
    const result = await this.executeQuery('MATCH (n) DETACH DELETE n', undefined, { timeoutMs: WRITE_QUERY_TIMEOUT_MS });
    if (!result.success) return DomainResult.fail(result.errors);
    return DomainResult.ok(undefined);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.executeQuery('RETURN 1 AS ok');
      return result.success;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.driver) await this.driver.close();
  }
}
