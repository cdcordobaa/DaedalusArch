import { ArchiveOrder } from './sales/application/ArchiveOrder';
import { ConfirmOrder } from './sales/application/ConfirmOrder';
import { EventSourcedOrderRepository } from './sales/infrastructure/EventSourcedOrderRepository';
import { InMemoryEventStore } from './sales/infrastructure/InMemoryEventStore';

export function createApp() {
  const store = new InMemoryEventStore();
  return { confirm: new ConfirmOrder(new EventSourcedOrderRepository(store)), archive: new ArchiveOrder(store) };
}
