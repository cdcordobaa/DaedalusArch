import type { PlaceOrder, PlaceOrderCommand } from '../application/PlaceOrder.js';
// VIOLATION (layering inside the context): the inbound adapter reaches a persistence adapter.
import type { InMemoryOrderRepository } from '../infrastructure/InMemoryOrderRepository.js';

/** Inbound adapter: translates a request body into a command. */
export class OrderController {
  constructor(private readonly placeOrder: PlaceOrder, private readonly repo?: InMemoryOrderRepository) {}

  async post(body: PlaceOrderCommand): Promise<{ status: number }> {
    await this.placeOrder.execute(body);
    return { status: 201 };
  }
}
