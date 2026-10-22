import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

/** A booking's seats were taken on the sailing. */
export class SeatsReserved implements DomainEvent {
  readonly type = 'SeatsReserved';

  constructor(
    readonly sailingId: string,
    readonly bookingId: string,
    readonly seats: number,
  ) {}
}
