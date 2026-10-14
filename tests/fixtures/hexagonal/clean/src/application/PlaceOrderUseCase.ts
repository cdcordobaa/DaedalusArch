import { Order } from '../domain/Order.js';
import type { OrderRepository } from '../domain/OrderRepository.js';
import type { PlaceOrderPort } from './PlaceOrderPort.js';

export class PlaceOrderUseCase implements PlaceOrderPort {
  constructor(private readonly repository: OrderRepository) {}

  execute(id: string, total: number): void {
    this.repository.save(new Order(id, total));
  }
}
