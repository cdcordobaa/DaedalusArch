import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class OrderPlaced implements DomainEvent {
  readonly type = 'OrderPlaced';

  constructor(
    readonly orderId: string,
    readonly memberId: string | null,
    readonly totalCents: number,
    readonly currency: string,
    /** What the customer pays after the discount, in cents. */
    readonly paidCents: number,
  ) {}
}
