import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class BookingCancelled implements DomainEvent {
  readonly type = 'BookingCancelled';

  constructor(
    readonly bookingId: string,
    readonly sailingId: string,
  ) {}
}
