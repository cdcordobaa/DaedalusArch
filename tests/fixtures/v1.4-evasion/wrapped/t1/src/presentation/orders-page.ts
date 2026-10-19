import { OrderStore } from '../business/order-proxy';

export function renderOrders(store: OrderStore): string {
  return store.all().join(', ');
}
