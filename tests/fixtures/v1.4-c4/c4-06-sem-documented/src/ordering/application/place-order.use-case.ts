import { Order } from '../domain/order';
import type { OrderLine } from '../domain/order';

export class PlaceOrderUseCase {
  private readonly placed: Order[] = [];

  execute(id: string, customerEmail: string, lines: readonly OrderLine[]): Order {
    const order = new Order(id, customerEmail, lines);
    this.placed.push(order);
    return order;
  }
}
