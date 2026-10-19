import { OrderStore } from '../persistence/order-store';

export function renderOrders(store: OrderStore): string {
  return store.all().join(', ');
}
