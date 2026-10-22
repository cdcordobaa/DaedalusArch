import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class SeatsTaken implements DomainEvent {
  readonly type = 'SeatsTaken';

  constructor(
    readonly sailingId: string,
    readonly bookingId: string,
    readonly seats: number,
  ) {}
}
