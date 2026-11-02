import type { Order } from '../domain/Order';
import type { OrderService } from '../application/OrderService';
import { PgOrderStore } from '../persistence/PgOrderStore';

export class OrderRoutes {
  private readonly fallback = new PgOrderStore();
  constructor(private readonly orders: OrderService) {}
  async getOrder(id: string): Promise<Order | undefined> {
    return (await this.orders.find(id)) ?? this.fallback.byId(id);
  }
}
