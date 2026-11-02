import type { Order } from '../domain/Order';
import type { OrderStore } from './ports/OrderStore';

export class OrderService {
  constructor(private readonly store: OrderStore) {}
  async find(id: string): Promise<Order | undefined> { return this.store.byId(id); }
}
