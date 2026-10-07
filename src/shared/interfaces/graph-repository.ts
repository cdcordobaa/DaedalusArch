import type { DomainResult } from '../errors/domain-result.js';

export interface QueryResult {
  readonly records: readonly Record<string, unknown>[];
  readonly summary: { readonly counters: Readonly<Record<string, number>> };
}

/**
 * Per-query options (NFR-07). `timeoutMs` bounds the query's transaction on the
 * server. No repository-wide default is applied here (D-U0-5; U2 sets it).
 */
export interface QueryOptions {
  readonly timeoutMs?: number;
}

export interface GraphRepository {
  executeQuery(
    cypher: string,
    params?: Record<string, unknown>,
    options?: QueryOptions,
  ): Promise<DomainResult<QueryResult>>;
  clearGraph(): Promise<DomainResult<void>>;
  healthCheck(): Promise<boolean>;
  close(): Promise<void>;
}
