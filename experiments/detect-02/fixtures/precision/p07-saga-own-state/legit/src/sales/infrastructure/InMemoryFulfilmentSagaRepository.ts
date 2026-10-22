import type { FulfilmentSaga } from '../domain/fulfilment/FulfilmentSaga';
import type { FulfilmentSagaRepository } from '../domain/fulfilment/FulfilmentSagaRepository';

export class InMemoryFulfilmentSagaRepository implements FulfilmentSagaRepository {
  private readonly rows = new Map<string, FulfilmentSaga>();

  async byId(id: string): Promise<FulfilmentSaga | undefined> {
    return this.rows.get(id);
  }

  async save(saga: FulfilmentSaga): Promise<void> {
    this.rows.set(saga.id, saga);
  }
}
