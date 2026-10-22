import { OrderLine } from '../domain/order/OrderLine';
import type { OrderRepository } from '../domain/order/OrderRepository';
import type { ProductRepository } from '../domain/product/ProductRepository';

export class AddLine {
  constructor(private readonly orders: OrderRepository, private readonly products: ProductRepository) {}

  /** Adds the line and reserves the stock in the same command: Order and Product both change. */
  async execute(orderId: string, lineId: string, sku: string, quantity: number): Promise<void> {
    const order = await this.orders.byId(orderId);
    const product = await this.products.byId(sku);
    if (order === undefined || product === undefined) throw new Error('unknown order or product');
    order.addLine(new OrderLine(lineId, sku, quantity));
    product.reserve(quantity);
    await this.orders.save(order);
    await this.products.save(product);
  }
}
