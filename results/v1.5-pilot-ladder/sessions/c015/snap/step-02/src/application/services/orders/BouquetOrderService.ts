import type { Order } from '../../../domain/model/Order';
import { OrderError } from '../../../domain/errors/OrderError';
import { OrderRules } from '../../../domain/services/OrderRules';
import type { BouquetOrders, OrderRequest, OrderView } from '../../ports/in/BouquetOrders';
import type { Orders } from '../../ports/out/storage/Orders';
import type { Couriers } from '../../ports/out/courier/Couriers';
import type { Tracking } from '../../ports/out/courier/Tracking';
import type { ParcelStage } from '../../../domain/model/TrackingUpdate';

const CUSTOMER_STATUS: Record<ParcelStage, string> = {
  label_created: 'PREPARING',
  picked_up: 'ON_ITS_WAY',
  in_transit: 'ON_ITS_WAY',
  out_for_delivery: 'ON_ITS_WAY',
  delivered: 'DELIVERED',
  delivery_failed: 'PROBLEM',
};

export class BouquetOrderService implements BouquetOrders {
  constructor(
    private readonly orders: Orders,
    private readonly couriers: Couriers,
    private readonly tracking: Tracking,
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
      signature: r.withWine ? 'adult' : 'none',
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
    if (o.state === 'cancelled') return { orderId: o.orderId, status: o.state };
    if (o.state !== 'sent' || o.trackingCode === undefined) return { orderId: o.orderId, status: 'ORDERED' };
    const u = await this.tracking.latest(o.trackingCode);
    return { orderId: o.orderId, status: CUSTOMER_STATUS[u.stage], trackingCode: o.trackingCode };
  }

  async changeMessage(orderId: string, message: string): Promise<OrderView> {
    const o = await this.get(orderId);
    if (o.state === 'sent' && o.trackingCode !== undefined) {
      const u = await this.tracking.latest(o.trackingCode);
      if (u.stage !== 'label_created') throw new OrderError('The bouquet has already left the shop.');
    } else if (o.state !== 'ordered') {
      throw new OrderError('The bouquet has already been sent.');
    }
    await this.orders.save({ ...o, message: this.rules.message(message) });
    return { orderId, status: 'message changed' };
  }

  async lastSeen(orderId: string): Promise<string> {
    const o = await this.get(orderId);
    if (o.trackingCode === undefined) return 'Not sent yet';
    const u = await this.tracking.latest(o.trackingCode);
    return 'Last seen in ' + u.place + ' (' + u.stageCode + ') at ' + u.at;
  }

  private async get(orderId: string): Promise<Order> {
    const o = await this.orders.get(orderId);
    if (o === null) throw new OrderError('there is no order ' + orderId);
    return o;
  }
}
