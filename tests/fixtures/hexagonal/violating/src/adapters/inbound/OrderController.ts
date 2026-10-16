import type { PlaceOrderPort } from '../../application/PlaceOrderPort.js';
import { Order } from '../../domain/Order.js';
import type { InMemoryOrderRepository } from '../outbound/InMemoryOrderRepository.js';

export class OrderController {
  constructor(private readonly placeOrder: PlaceOrderPort, private readonly repository: InMemoryOrderRepository) {}

  post(body: { id: string; total: number }): void {
    this.placeOrder.execute(body.id, body.total);
    this.repository.save(new Order(body.id, body.total));
  }
}
