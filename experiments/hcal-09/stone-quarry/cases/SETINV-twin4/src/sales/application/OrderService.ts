import { newId } from '../../shared-kernel/ids';
import { OrderDto } from '../contracts/OrderDto';
import { OrderRepository } from '../domain/order/OrderRepository';
import { QuarryOrder } from '../domain/order/QuarryOrder';
import { orderLine, Product } from '../domain/order/value-objects/OrderLine';

const toDto = (o: QuarryOrder): OrderDto => ({ id: o.id, customerId: o.customerId, orderedTonnes: o.orderedTonnes, deliveredTonnes: o.deliveredTonnes });

export class OrderService {
  constructor(private readonly orders: OrderRepository) {}

  async placeOrder(customerId: string, lines: readonly { product: Product; tonnes: number }[]): Promise<OrderDto> {
    const order = QuarryOrder.place(newId('QO'), customerId, lines.map((l) => orderLine(l.product, l.tonnes)));
    await this.orders.save(order);
    return toDto(order);
  }

  async removeLine(orderId: string, index: number): Promise<OrderDto | null> {
    const order = await this.orders.findById(orderId);
    if (order === null) return null;
    order.removeLine(index);
    await this.orders.save(order);
    return toDto(order);
  }

  async recordDelivery(orderId: string, tonnes: number): Promise<void> {
    const order = await this.orders.findById(orderId);
    if (order === null) return;
    order.recordDelivery(tonnes);
    await this.orders.save(order);
  }
}
