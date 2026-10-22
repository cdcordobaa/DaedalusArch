import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

/** A sailing had too few seats left for a booking; nothing was taken. */
export class SeatsRefused implements DomainEvent {
  readonly type = 'SeatsRefused';

  constructor(
    readonly sailingId: string,
    readonly bookingId: string,
    readonly seats: number,
  ) {}
}
