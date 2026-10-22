import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class SeatsHeld implements DomainEvent {
  readonly type = 'SeatsHeld';

  constructor(
    readonly sailingId: string,
    readonly bookingId: string,
  ) {}
}
