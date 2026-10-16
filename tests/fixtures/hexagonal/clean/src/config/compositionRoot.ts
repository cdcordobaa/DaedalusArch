import { PlaceOrderUseCase } from '../application/PlaceOrderUseCase.js';
import { OrderController } from '../adapters/inbound/OrderController.js';
import { InMemoryOrderRepository } from '../adapters/outbound/InMemoryOrderRepository.js';

export function compose(): OrderController {
  return new OrderController(new PlaceOrderUseCase(new InMemoryOrderRepository()));
}
