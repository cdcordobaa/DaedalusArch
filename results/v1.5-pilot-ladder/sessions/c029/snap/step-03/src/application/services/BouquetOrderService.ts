import type { Order } from '../../domain/model/Order';
import { OrderError } from '../../domain/errors/OrderError';
import { OrderRules } from '../../domain/services/OrderRules';
import type { BouquetOrders, OrderRequest, OrderView } from '../ports/in/BouquetOrders';
import type { Orders } from '../ports/out/Orders';
import type { Couriers } from '../ports/out/Couriers';

export class BouquetOrderService implements BouquetOrders {
  constructor(
    private readonly orders: Orders,
    private readonly couriers: Couriers,
    private readonly rules: OrderRules = new OrderRules(),
  ) {}

  async place(r: OrderRequest): Promise<OrderView> {
    const order: Order = {
      orderId: r.orderId,
      recipient: this.rules.required(r.recipient, 'recipient'),
      street: this.rules.required(r.street, 'street'),
      postcode: this.rules.postcode(r.postcode),
      city: this.rules.required(r.city, 'city'),
      message: this.rules.message(r.message),
      state: 'ordered',
    };
    await this.orders.save(order);
    return { orderId: order.orderId, status: 'ordered' };
  }

  async send(orderId: string): Promise<OrderView> {
    const o = await this.get(orderId);
    if (o.state !== 'ordered') throw new OrderError('only an ordered bouquet can be sent');
    const trackingCode = await this.couriers.book(o);
    await this.orders.save({ ...o, trackingCode, state: 'sent' });
    return { orderId, status: 'sent', trackingCode };
  }

  async status(orderId: string): Promise<OrderView> {
    const o = await this.get(orderId);
    if (o.state === 'sent' && o.trackingCode !== undefined) {
      return { orderId: o.orderId, status: await this.couriers.track(o.trackingCode), trackingCode: o.trackingCode };
    }
    return { orderId: o.orderId, status: o.state === 'sent' ? 'sent' : o.state };
  }

  async changeMessage(orderId: string, message: string): Promise<OrderView> {
    const o = await this.get(orderId);
    if (o.state === 'sent') {
      const stage = o.trackingCode === undefined ? 'preparing' : await this.couriers.track(o.trackingCode);
      if (stage !== 'preparing') throw new OrderError('The bouquet has already left the shop.');
    } else if (o.state !== 'ordered') {
      throw new OrderError('The bouquet has already been sent.');
    }
    await this.orders.save({ ...o, message: this.rules.message(message) });
    return { orderId, status: 'message changed' };
  }

  async cancel(orderId: string): Promise<OrderView> {
    const o = await this.get(orderId);
    if (o.state === 'sent') throw new OrderError('The bouquet has already been sent.');
    if (o.state === 'ordered') await this.orders.save({ ...o, state: 'cancelled' });
    return { orderId, status: 'cancelled' };
  }

  private async get(orderId: string): Promise<Order> {
    const o = await this.orders.get(orderId);
    if (o === null) throw new OrderError('there is no order ' + orderId);
    return o;
  }
}
