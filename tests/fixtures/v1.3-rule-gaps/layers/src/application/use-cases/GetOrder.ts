import { Order } from '../../domain/entities/Order';
import { OrderRepository } from '../../domain/repositories/OrderRepository';

// violating (use-case-exposes-entity): returns the entity across the boundary.
export class GetOrder {
  constructor(private readonly orders: OrderRepository) {}
  async execute(id: string): Promise<Order | undefined> {
    return this.load(id);
  }
  // look-alike: a private member is not the boundary.
  private async load(id: string): Promise<Order | undefined> {
    return this.orders.findById(id);
  }
}
