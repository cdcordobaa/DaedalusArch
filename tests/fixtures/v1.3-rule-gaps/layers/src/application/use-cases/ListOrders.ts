import { OrderRepository } from '../../domain/repositories/OrderRepository';
import { Money } from '../../domain/value-objects/Money';
import { OrderDto } from '../dto/OrderDto';

// clean (use-case-framework-free, use-case-exposes-entity): DTOs out, no framework import.
export class ListOrders {
  constructor(private readonly orders: OrderRepository) {}
  async one(id: string): Promise<OrderDto | undefined> {
    const o = await this.orders.findById(id);
    return o === undefined ? undefined : { id: o.id, totalCents: o.total.cents };
  }
  // look-alike (use-case-exposes-entity): a value object is not an entity.
  zero(): Money {
    return new Money(0);
  }
}
