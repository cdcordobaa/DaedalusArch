import { OrderService } from '../application/OrderService';
import { OrderDto } from '../contracts/OrderDto';
import { Product } from '../domain/order/value-objects/OrderLine';

export class OrderController {
  constructor(private readonly orders: OrderService) {}

  async postOrder(body: { customerId: string; lines: { product: Product; tonnes: number }[] }): Promise<{ status: 201; body: OrderDto }> {
    return { status: 201, body: await this.orders.placeOrder(body.customerId, body.lines) };
  }

  async deleteLine(params: { orderId: string; index: number }): Promise<{ status: 200 | 404; body: OrderDto | null }> {
    const body = await this.orders.removeLine(params.orderId, params.index);
    return { status: body === null ? 404 : 200, body };
  }
}
