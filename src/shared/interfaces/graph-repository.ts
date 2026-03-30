import type { DomainResult } from '../errors/domain-result.js';

export interface QueryResult {
  readonly records: readonly Record<string, unknown>[];
  readonly summary: { readonly counters: Readonly<Record<string, number>> };
}

export interface GraphRepository {
  executeQuery(cypher: string, params?: Record<string, unknown>): Promise<DomainResult<QueryResult>>;
  clearGraph(): Promise<DomainResult<void>>;
  healthCheck(): Promise<boolean>;
  close(): Promise<void>;
}
