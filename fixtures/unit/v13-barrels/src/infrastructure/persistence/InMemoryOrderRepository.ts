import {
  Order,
  type OrderRepository,
  type OrderSnapshot,
  type OrderStatus,
} from '../../application/ports/persistence';

export class InMemoryOrderRepository implements OrderRepository {
  private readonly records = new Map<string, OrderSnapshot>();
  private status: OrderStatus = 'new';

  findById(id: string): Order | undefined {
    return this.records.has(id) ? new Order(id) : undefined;
  }
}
