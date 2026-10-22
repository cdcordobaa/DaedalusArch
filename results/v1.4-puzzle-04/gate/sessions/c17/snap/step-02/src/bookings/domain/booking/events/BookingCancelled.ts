import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

/** A booking that held seats was cancelled. */
export class BookingCancelled implements DomainEvent {
  readonly type = 'BookingCancelled';

  constructor(
    readonly bookingId: string,
    readonly sailingId: string,
  ) {}
}
