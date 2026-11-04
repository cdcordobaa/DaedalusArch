import { OrderService } from '../application/OrderService';
import { OrderDto } from '../contracts/OrderDto';
import { Product } from '../domain/order/value-objects/OrderLine';

export class OrderController {
  constructor(private readonly orders: OrderService) {}

  async postOrder(body: { customerId: string; lines: { product: Product; tonnes: number }[] }): Promise<{ status: 201; body: OrderDto }> {
    return { status: 201, body: await this.orders.placeOrder(body.customerId, body.lines) };
  }
}
