import { Money } from '../../shared-kernel/Money';
import { AuditEntry } from '../domain/audit/AuditEntry';
import { Order } from '../domain/order/Order';
import type { OrderRepository } from '../domain/order/OrderRepository';
import type { AuditTrail } from './ports/AuditTrail';
import type { IdempotencyStore } from './ports/IdempotencyStore';

export class PlaceOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly audit: AuditTrail,
    private readonly idempotency: IdempotencyStore,
  ) {}

  async execute(requestKey: string, actor: string, customerId: string, totalCents: number): Promise<string> {
    const seen = await this.idempotency.find(requestKey);
    if (seen !== undefined) return seen.orderId;
    const order = Order.place(this.orders.nextId(), customerId, Money.of(totalCents));
    await this.orders.save(order);
    await this.audit.record(new AuditEntry(`A-${requestKey}`, actor, 'order.placed', order.id, new Date()));
    await this.idempotency.remember({ key: requestKey, orderId: order.id });
    return order.id;
  }
}
