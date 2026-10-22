import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import { SailingError } from '../domain/SailingError';
import type { SailingRepository } from '../domain/sailing/SailingRepository';
import { SailingId } from '../domain/sailing/value-objects/SailingId';

/** The fields of a booking request that sailings cares about. */
interface BookingRequest {
  readonly bookingId: string;
  readonly sailingId: string;
  readonly seats: number;
}

/** Takes the seats a new booking asks for, or records that there are not enough. */
export class ReserveSeatsForBooking {
  constructor(private readonly sailings: SailingRepository) {}

  handle(event: DomainEvent): void {
    const request = event as unknown as BookingRequest;
    const sailing = this.sailings.byId(SailingId.of(request.sailingId));
    if (sailing === undefined) throw new SailingError(`no sailing ${request.sailingId}`);
    sailing.reserveFor(request.bookingId, request.seats);
    this.sailings.save(sailing);
  }
}
