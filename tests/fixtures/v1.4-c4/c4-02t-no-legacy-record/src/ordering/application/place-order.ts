import { Order } from '../domain/order/Order';
import type { OrderRepository } from '../domain/order/OrderRepository';

export class PlaceOrder {
  constructor(private readonly repo: OrderRepository) {}

  run(id: string, sku: string, quantity: number): void {
    const order = new Order(id);
    order.add(sku, quantity);
    this.repo.save(order);
  }
}
