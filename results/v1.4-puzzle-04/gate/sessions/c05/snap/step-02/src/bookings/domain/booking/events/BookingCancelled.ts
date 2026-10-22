import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

/** A confirmed booking was cancelled, so its seats are no longer needed. */
export class BookingCancelled implements DomainEvent {
  readonly type = 'BookingCancelled';

  constructor(
    readonly bookingId: string,
    readonly sailingId: string,
  ) {}
}
