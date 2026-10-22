import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

/** Seats were taken on a sailing for a booking. */
export class SeatsReserved implements DomainEvent {
  readonly type = 'SeatsReserved';

  constructor(
    readonly sailingId: string,
    readonly bookingId: string,
    readonly seats: number,
  ) {}
}
