import neo4j, { type Driver, type Session } from 'neo4j-driver';
import type { GraphRepository, QueryResult } from '../shared/interfaces/graph-repository.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import type { IngestionConfig } from './types.js';
import { DEFAULT_INGESTION_CONFIG } from './types.js';

export class Neo4jRepository implements GraphRepository {
  private readonly driver: Driver;

  constructor(config: Partial<IngestionConfig> = {}) {
    const cfg = { ...DEFAULT_INGESTION_CONFIG, ...config };
    this.driver = neo4j.driver(cfg.neo4jUri, neo4j.auth.basic(cfg.neo4jUser, cfg.neo4jPassword));
  }

  async executeQuery(cypher: string, params?: Record<string, unknown>): Promise<DomainResult<QueryResult>> {
    let session: Session | undefined;
    try {
      session = this.driver.session();
      const result = await session.run(cypher, params);
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
    const result = await this.executeQuery('MATCH (n) DETACH DELETE n');
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
    await this.driver.close();
  }
}
