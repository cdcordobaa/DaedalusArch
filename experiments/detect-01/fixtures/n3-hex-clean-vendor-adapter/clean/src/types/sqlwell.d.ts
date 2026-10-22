// Typings of the sqlwell PostgreSQL client (package sqlwell), vendored with the project.
declare module 'sqlwell' {
  export interface QueryResult<Row> {
    rows: Row[];
    rowCount: number;
  }
  export interface Queryable {
    query<Row = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<QueryResult<Row>>;
  }
  export interface Transaction extends Queryable {
    readonly id: string;
  }
}
