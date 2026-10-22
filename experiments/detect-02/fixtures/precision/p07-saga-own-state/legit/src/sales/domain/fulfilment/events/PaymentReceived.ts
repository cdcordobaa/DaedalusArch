import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class PaymentReceived implements DomainEvent {
  readonly type = 'PaymentReceived';

  constructor(readonly orderId: string) {}
}
