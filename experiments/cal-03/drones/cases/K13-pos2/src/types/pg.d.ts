declare module 'pg' {
  export interface PoolClient {
    query(sql: string, params?: unknown[]): unknown;
  }
}
