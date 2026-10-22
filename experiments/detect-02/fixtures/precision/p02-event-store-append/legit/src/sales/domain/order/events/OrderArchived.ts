import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class OrderArchived implements DomainEvent {
  readonly type = 'OrderArchived';

  constructor(readonly orderId: string, readonly reason: string) {}
}
