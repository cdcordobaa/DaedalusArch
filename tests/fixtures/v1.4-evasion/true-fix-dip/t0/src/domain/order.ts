import { OrderDb } from '../adapters/outbound/order-db';

export interface Order {
  readonly id: string;
}

export function saveOrder(o: Order): void {
  new OrderDb().insert(o.id);
}
