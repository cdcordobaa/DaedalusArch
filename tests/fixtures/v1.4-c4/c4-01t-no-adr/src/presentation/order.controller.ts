import { OrderService } from '../business/order.service';
import { OrderReadRepository } from '../persistence/order-read.repository';

export class OrderController {
  constructor(
    private readonly orders: OrderService,
    private readonly reads: OrderReadRepository,
  ) {}

  place(customerId: string, sku: string, quantity: number): string {
    return this.orders.place(customerId, sku, quantity);
  }

  list(customerId: string): readonly string[] {
    return this.reads.findSummaries(customerId);
  }
}
