import { OrderRepository } from '../domain/repositories/OrderRepository';

// violating (controller-bypasses-application): the controller holds the repository port, skipping the use cases.
export class OrderController {
  constructor(private readonly orders: OrderRepository) {}
  async show(id: string): Promise<string> {
    const o = await this.orders.findById(id);
    return o?.id ?? 'none';
  }
}
