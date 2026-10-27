import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class TableBooked implements DomainEvent {
  readonly type = 'TableBooked';

  constructor(
    readonly reservationId: string,
    readonly guestId: string | null,
    readonly partySize: number,
    readonly depositCents: number,
    readonly currency: string,
  ) {}
}
