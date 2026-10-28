export interface UnitOfWork {
  run<T>(work: () => T): T;
}

export class InMemoryUnitOfWork implements UnitOfWork {
  run<T>(work: () => T): T {
    return work();
  }
}
