import type { DomainEvent } from '../../../../shared-kernel/DomainEvent.js';
import { systemClock } from '../../../../shared-kernel/Clock.js';

export class OrderPlaced implements DomainEvent {
  readonly name = 'ordering.order-placed';
  readonly occurredAt = systemClock.now();

  constructor(readonly orderId: string, readonly totalCents: number) {}
}
