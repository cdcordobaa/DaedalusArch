export interface TransactionHandle {
  readonly id: number;
}

export interface TransactionManager {
  run<T>(work: () => T): T;
}

export class InMemoryTransactionManager implements TransactionManager {
  run<T>(work: () => T): T {
    return work();
  }
}
