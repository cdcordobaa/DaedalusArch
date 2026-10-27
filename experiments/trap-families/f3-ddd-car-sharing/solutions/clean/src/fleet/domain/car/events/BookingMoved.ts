import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

/** A booking was taken over by this car; the car it came from releases it on delivery. */
export class BookingMoved implements DomainEvent {
  readonly type = 'BookingMoved';

  constructor(
    readonly moveId: string,
    readonly bookingId: string,
    readonly fromCarId: string,
    readonly toCarId: string,
  ) {}
}
