import { MergeOrders } from './sales/application/MergeOrders';
import { InMemoryOrderRepository } from './sales/infrastructure/InMemoryOrderRepository';

export function createApp() {
  return { command: new MergeOrders(new InMemoryOrderRepository()) };
}
