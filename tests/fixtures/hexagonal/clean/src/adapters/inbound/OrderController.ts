import type { PlaceOrderPort } from '../../application/PlaceOrderPort.js';

export class OrderController {
  constructor(private readonly placeOrder: PlaceOrderPort) {}

  post(body: { id: string; total: number }): void {
    this.placeOrder.execute(body.id, body.total);
  }
}
