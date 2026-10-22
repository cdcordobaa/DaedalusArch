import type { TransactionRunner } from '../application/ports/TransactionRunner';

export class InMemoryTransactionRunner implements TransactionRunner {
  async run<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}
