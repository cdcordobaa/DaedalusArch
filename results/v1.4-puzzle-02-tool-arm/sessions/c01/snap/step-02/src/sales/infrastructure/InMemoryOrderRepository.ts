import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { Outbox } from '../application/ports/Outbox';
import { Order, type OrderState } from '../domain/order/Order';
import type { OrderRepository } from '../domain/order/OrderRepository';
import { OrderId } from '../domain/order/value-objects/OrderId';

/** Orders and their outbox in one store: saving an order stores its pending events in the same step. */
export class InMemoryOrderRepository implements OrderRepository, Outbox {
  private readonly rows = new Map<string, OrderState>();
  private outbox: DomainEvent[] = [];
  private sequence = 0;

  nextId(): OrderId {
    this.sequence += 1;
    return OrderId.of(`O-${String(this.sequence).padStart(4, '0')}`);
  }

  byId(id: OrderId): Order | undefined {
    const row = this.rows.get(id.value);
    return row === undefined ? undefined : Order.restore(row);
  }

  save(order: Order): void {
    const events = order.pullEvents();
    this.rows.set(order.id.value, order.state());
    this.outbox = [...this.outbox, ...events];
  }

  takePending(): DomainEvent[] {
    const out = this.outbox;
    this.outbox = [];
    return out;
  }
}
