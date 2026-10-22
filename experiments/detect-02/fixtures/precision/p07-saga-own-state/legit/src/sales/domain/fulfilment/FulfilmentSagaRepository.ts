import type { FulfilmentSaga } from './FulfilmentSaga';

export interface FulfilmentSagaRepository {
  byId(id: string): Promise<FulfilmentSaga | undefined>;
  save(saga: FulfilmentSaga): Promise<void>;
}
