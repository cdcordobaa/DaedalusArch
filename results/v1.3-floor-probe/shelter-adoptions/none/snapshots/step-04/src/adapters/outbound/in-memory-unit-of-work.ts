import { UnitOfWork } from '../../application/ports';

export interface Snapshottable {
  snapshot(): unknown;
  restore(state: unknown): void;
}

/** In-memory transaction: snapshots every store before the work and restores them all if it throws. */
export class InMemoryUnitOfWork implements UnitOfWork {
  private depth = 0;
  constructor(private readonly stores: Snapshottable[]) {}

  run<T>(work: () => T): T {
    if (this.depth > 0) return work();
    const snapshots = this.stores.map((s) => s.snapshot());
    this.depth++;
    try {
      return work();
    } catch (err) {
      this.stores.forEach((s, i) => s.restore(snapshots[i]));
      throw err;
    } finally {
      this.depth--;
    }
  }
}
