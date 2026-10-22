import { OrderArchived } from '../domain/order/events/OrderArchived';
import type { EventStore } from './ports/EventStore';

/** Archiving is a pure fact on the order's stream: no state to load. */
export class ArchiveOrder {
  constructor(private readonly store: EventStore) {}

  async execute(orderId: string, version: number, reason: string): Promise<void> {
    await this.store.append(`order-${orderId}`, [new OrderArchived(orderId, reason)], version);
  }
}
