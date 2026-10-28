import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class ReservationRequested implements DomainEvent {
  readonly type = 'ReservationRequested';

  constructor(
    readonly reservationId: string,
    readonly carParkId: string,
    readonly driver: string,
    readonly bays: number,
  ) {}
}
