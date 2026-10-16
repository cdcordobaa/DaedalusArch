import type { PlaceOrderInput, PlaceOrderUseCase } from '../../application/use-cases/place-order';

export class OrderController {
  constructor(private readonly placeOrder: PlaceOrderUseCase) {}

  async post(body: PlaceOrderInput): Promise<{ status: number; body: { id: string } }> {
    const order = await this.placeOrder.execute(body);
    return { status: 201, body: { id: order.id } };
  }
}
