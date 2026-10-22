import { CompleteShipment } from './sales/application/CompleteShipment';
import { InMemoryFulfilmentSagaRepository } from './sales/infrastructure/InMemoryFulfilmentSagaRepository';
import { InMemoryOrderRepository } from './sales/infrastructure/InMemoryOrderRepository';

export function createApp() {
  return { complete: new CompleteShipment(new InMemoryFulfilmentSagaRepository(), new InMemoryOrderRepository()) };
}
