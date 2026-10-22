import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class BookingRequested implements DomainEvent {
  readonly type = 'BookingRequested';

  constructor(
    readonly bookingId: string,
    readonly sailingId: string,
    readonly passenger: string,
    readonly seats: number,
  ) {}
}
