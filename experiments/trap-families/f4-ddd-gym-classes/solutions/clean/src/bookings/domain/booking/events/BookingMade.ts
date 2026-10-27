import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class BookingMade implements DomainEvent {
  readonly type = 'BookingMade';

  constructor(
    readonly bookingId: string,
    readonly memberId: string | null,
    readonly totalCents: number,
    readonly currency: string,
    readonly sessions: number,
  ) {}
}
