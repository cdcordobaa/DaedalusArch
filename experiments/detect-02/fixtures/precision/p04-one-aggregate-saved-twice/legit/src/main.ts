import { ConfirmOrder } from './sales/application/ConfirmOrder';
import { InMemoryOrderRepository } from './sales/infrastructure/InMemoryOrderRepository';

export function createApp() {
  return { command: new ConfirmOrder(new InMemoryOrderRepository()) };
}
