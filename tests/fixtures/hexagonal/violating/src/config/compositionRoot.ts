import { PlaceOrderUseCase } from '../application/PlaceOrderUseCase.js';
import { OrderController } from '../adapters/inbound/OrderController.js';
import { InMemoryOrderRepository } from '../adapters/outbound/InMemoryOrderRepository.js';

export function compose(): OrderController {
  const repository = new InMemoryOrderRepository();
  return new OrderController(new PlaceOrderUseCase(repository), repository);
}
