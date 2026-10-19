import { OrderStore } from '../persistence/order-store';

export class OrderService {
  constructor(private readonly store: OrderStore) {}

  place(id: string): void {
    this.store.save(id);
  }
}
