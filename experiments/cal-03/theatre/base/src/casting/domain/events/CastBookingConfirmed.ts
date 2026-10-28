import { DomainEvent } from '../../../shared-kernel/DomainEvent';

export class CastBookingConfirmed implements DomainEvent {
  readonly name = 'CastBookingConfirmed';
  readonly occurredAt = Date.now();

  constructor(
    readonly bookingId: string,
    readonly productionId: string,
    readonly actorId: string,
    readonly totalDue: number,
  ) {}
}
