import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class ReservationCancelled implements DomainEvent {
  readonly type = 'ReservationCancelled';

  constructor(
    readonly reservationId: string,
    readonly carParkId: string,
  ) {}
}
