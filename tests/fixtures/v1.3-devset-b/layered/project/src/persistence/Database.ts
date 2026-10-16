/** Stand-in for a relational database: one keyed table per name. */
export class InMemoryDatabase {
  private readonly tables = new Map<string, Map<string, unknown>>();

  table<T>(name: string): Map<string, T> {
    let table = this.tables.get(name);
    if (table === undefined) {
      table = new Map<string, unknown>();
      this.tables.set(name, table);
    }
    return table as Map<string, T>;
  }
}
