import { OrderStore } from '../persistence/order-store';

export function readOrders(store: OrderStore): string {
  return store.all().join(', ');
}
