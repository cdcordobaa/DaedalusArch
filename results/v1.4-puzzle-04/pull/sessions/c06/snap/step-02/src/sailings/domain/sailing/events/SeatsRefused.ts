import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

/** A booking's seats could not be taken: the sailing has too few left. */
export class SeatsRefused implements DomainEvent {
  readonly type = 'SeatsRefused';

  constructor(
    readonly sailingId: string,
    readonly bookingId: string,
    readonly seats: number,
  ) {}
}
