import type { DomainEvent } from '../../../../shared-kernel/DomainEvent.js';

export class OrderPlaced implements DomainEvent {
  readonly name = 'ordering.order-placed';
  readonly occurredAt = new Date();

  constructor(readonly orderId: string, readonly totalCents: number) {}
}
