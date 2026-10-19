import { OrderRepository } from '../persistence/order.repository';

export class OrderService {
  constructor(private readonly repo: OrderRepository) {}

  place(customerId: string, sku: string, quantity: number): string {
    if (quantity <= 0) throw new Error('quantity must be positive');
    return this.repo.save({ customerId, sku, quantity });
  }
}
