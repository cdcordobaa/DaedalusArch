import { UnitOfWork } from './UnitOfWork';

export class InMemoryUnitOfWork implements UnitOfWork {
  async run<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}
