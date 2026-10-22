import { PlaceOrder } from './sales/application/PlaceOrder';
import { InMemoryAuditTrail } from './sales/infrastructure/InMemoryAuditTrail';
import { InMemoryIdempotencyStore } from './sales/infrastructure/InMemoryIdempotencyStore';
import { InMemoryOrderRepository } from './sales/infrastructure/InMemoryOrderRepository';

export function createApp() {
  return { placeOrder: new PlaceOrder(new InMemoryOrderRepository(), new InMemoryAuditTrail(), new InMemoryIdempotencyStore()) };
}
