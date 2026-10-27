import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class ReservationCompleted implements DomainEvent {
  readonly type = 'ReservationCompleted';

  constructor(
    readonly reservationId: string,
    readonly guestId: string | null,
  ) {}
}
