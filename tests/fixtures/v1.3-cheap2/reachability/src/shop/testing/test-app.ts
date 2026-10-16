import { OrderStore } from '../infrastructure/order.store';

/** NEAR-MISS N6: a test composition root is reached from tests, never from a production entry. */
export function testApp(): OrderStore {
  return new OrderStore();
}
