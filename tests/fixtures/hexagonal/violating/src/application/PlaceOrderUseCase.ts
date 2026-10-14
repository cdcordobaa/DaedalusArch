import { Order } from '../domain/Order.js';
import type { InMemoryOrderRepository } from '../adapters/outbound/InMemoryOrderRepository.js';
import type { PlaceOrderPort } from './PlaceOrderPort.js';

export class PlaceOrderUseCase implements PlaceOrderPort {
  constructor(private readonly repository: InMemoryOrderRepository) {}

  execute(id: string, total: number): void {
    this.repository.save(new Order(id, total));
  }
}
