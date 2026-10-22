import { OutboxRelay } from './sales/application/OutboxRelay';
import { PlaceOrder } from './sales/application/PlaceOrder';
import { InMemoryEventBus } from './sales/infrastructure/InMemoryEventBus';
import { InMemoryOrderRepository } from './sales/infrastructure/InMemoryOrderRepository';
import { InMemoryOutbox } from './sales/infrastructure/InMemoryOutbox';
import { InMemoryTransactionRunner } from './sales/infrastructure/InMemoryTransactionRunner';

export function createApp() {
  const outbox = new InMemoryOutbox();
  return {
    placeOrder: new PlaceOrder(new InMemoryOrderRepository(), outbox, new InMemoryTransactionRunner()),
    relay: new OutboxRelay(outbox, new InMemoryEventBus()),
  };
}
