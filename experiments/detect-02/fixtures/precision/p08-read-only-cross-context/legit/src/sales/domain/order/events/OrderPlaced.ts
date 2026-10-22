import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class OrderPlaced implements DomainEvent {
  readonly type = 'OrderPlaced';

  constructor(readonly orderId: string, readonly customerId: string, readonly totalCents: number) {}
}
