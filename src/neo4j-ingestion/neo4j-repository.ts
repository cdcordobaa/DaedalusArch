import neo4j, { type Driver, type Session } from 'neo4j-driver';
import type { GraphRepository, QueryOptions, QueryResult } from '../shared/interfaces/graph-repository.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import type { DomainWarning } from '../shared/errors/domain-result.js';
import { neo4jScrubPolicy, scrubWithPolicy } from '../shared/errors/scrub.js';
import type { ScrubPolicy } from '../shared/errors/scrub.js';
import type { IngestionConfig, Neo4jRepositoryConfig } from './types.js';
import { DEFAULT_INGESTION_CONFIG, WRITE_QUERY_TIMEOUT_MS } from './types.js';

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function errorCode(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'code' in e) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === 'string' || typeof code === 'number') return String(code);
  }
  return 'UNEXPECTED_ERROR';
}

export class Neo4jRepository implements GraphRepository {
  private readonly cfg: IngestionConfig;
  private readonly repoSecrets: ScrubPolicy;
  /** Created lazily by the first query (BR-U2-41); the constructor never touches the driver. */
  private driver: Driver | undefined;

  constructor(config: Neo4jRepositoryConfig) {
    this.cfg = { ...DEFAULT_INGESTION_CONFIG, ...config };
    this.repoSecrets = neo4jScrubPolicy(this.cfg);
  }

  /** NFR-05, D-U0-6: resolved addresses first, then known secrets and credential shapes (BR-U2-39);
   * the policy lives in `src/shared/errors/scrub.ts` since U3-R11 (BR-U3-58), so it exists once. */
  private scrub(text: string): string {
    return scrubWithPolicy(text, this.repoSecrets);
  }

  async executeQuery(
    cypher: string,
    params?: Record<string, unknown>,
    options?: QueryOptions,
  ): Promise<DomainResult<QueryResult>> {
    let session: Session | undefined;
    let outcome: DomainResult<QueryResult>;
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
      outcome = DomainResult.ok({ records, summary: { counters } });
    } catch (e) {
      // BR-U2-40: every failure message scrubbed, the original code kept.
      outcome = DomainResult.fail([{ code: errorCode(e), message: this.scrub(errorMessage(e)) }]);
    }
    if (session) {
      try {
        await session.close();
      } catch (e) {
        // S-2: a close failure never throws; after a successful run it becomes one warning,
        // after a failed run the run error stands alone.
        if (outcome.success) {
          const warning: DomainWarning = { code: 'REPO_SESSION_CLOSE_FAILED', message: this.scrub(errorMessage(e)) };
          outcome = DomainResult.ok(outcome.data, [...(outcome.warnings ?? []), warning]);
        }
      }
    }
    return outcome;
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
