import { Money } from '../../shared-kernel/Money';
import type { EventStore } from '../application/ports/EventStore';
import { Order } from '../domain/order/Order';
import type { OrderPlaced } from '../domain/order/events/OrderPlaced';
import type { OrderRepository } from '../domain/order/OrderRepository';

/** The order's stream is its history: saving appends the events it recorded since it was loaded. */
export class EventSourcedOrderRepository implements OrderRepository {
  private seq = 0;
  private readonly versions = new Map<string, number>();

  constructor(private readonly store: EventStore) {}

  nextId(): string {
    this.seq += 1;
    return `O-${this.seq}`;
  }

  async byId(id: string): Promise<Order | undefined> {
    const events = await this.store.read(`order-${id}`);
    const placed = events.find((e) => e.type === 'OrderPlaced') as OrderPlaced | undefined;
    if (placed === undefined) return undefined;
    this.versions.set(id, events.length);
    return Order.restore(id, placed.customerId, Money.of(placed.totalCents), events.some((e) => e.type === 'OrderConfirmed') ? 'confirmed' : 'placed');
  }

  async save(order: Order): Promise<void> {
    const events = order.pullEvents();
    await this.store.append(`order-${order.id}`, events, this.versions.get(order.id) ?? 0);
    this.versions.set(order.id, (this.versions.get(order.id) ?? 0) + events.length);
  }
}
