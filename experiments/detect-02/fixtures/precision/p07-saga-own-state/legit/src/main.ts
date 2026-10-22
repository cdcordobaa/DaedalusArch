import { FulfilmentProcess } from './sales/application/FulfilmentProcess';
import { InMemoryCommandBus } from './sales/infrastructure/InMemoryCommandBus';
import { InMemoryFulfilmentSagaRepository } from './sales/infrastructure/InMemoryFulfilmentSagaRepository';

export function createApp() {
  return { process: new FulfilmentProcess(new InMemoryFulfilmentSagaRepository(), new InMemoryCommandBus()) };
}
