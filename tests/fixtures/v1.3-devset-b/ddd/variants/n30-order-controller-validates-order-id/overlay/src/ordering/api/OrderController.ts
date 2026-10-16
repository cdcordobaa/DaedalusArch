import type { PlaceOrder, PlaceOrderCommand } from '../application/PlaceOrder.js';
import { OrderId } from '../domain/order/value-objects/OrderId.js';

/** Inbound adapter: translates a request body into a command. */
export class OrderController {
  constructor(private readonly placeOrder: PlaceOrder) {}

  async post(body: PlaceOrderCommand): Promise<{ status: number }> {
    const id = new OrderId(body.orderId);
    await this.placeOrder.execute({ ...body, orderId: id.value });
    return { status: 201 };
  }
}
