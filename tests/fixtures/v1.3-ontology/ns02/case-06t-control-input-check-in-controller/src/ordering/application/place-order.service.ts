import { Order } from '../domain/order';
import type { OrderRepository } from '../domain/order-repository';

export class PlaceOrderService {
  private next = 1;

  constructor(private readonly orders: OrderRepository) {}

  place(sku: string, quantity: number): Order {
    const order = Order.create(`ord-${String(this.next++)}`, sku, quantity);
    this.orders.save(order);
    return order;
  }
}
