export interface TransactionManager {
  run<T>(work: () => Promise<T>): Promise<T>;
}

export class InMemoryTransactionManager implements TransactionManager {
  private depth = 0;

  async run<T>(work: () => Promise<T>): Promise<T> {
    this.depth += 1;
    try {
      return await work();
    } finally {
      this.depth -= 1;
    }
  }
}
