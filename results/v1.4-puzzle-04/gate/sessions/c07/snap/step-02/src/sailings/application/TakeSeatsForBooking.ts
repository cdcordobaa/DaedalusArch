import { SailingError } from '../domain/SailingError';
import type { SailingRepository } from '../domain/sailing/SailingRepository';
import { SailingId } from '../domain/sailing/value-objects/SailingId';

/** A booking asks for seats: they are all taken or none are, and the outcome is recorded as an event. */
export class TakeSeatsForBooking {
  constructor(private readonly sailings: SailingRepository) {}

  execute(sailingId: string, bookingId: string, seats: number): void {
    const sailing = this.sailings.byId(SailingId.of(sailingId));
    if (sailing === undefined) throw new SailingError(`no sailing ${sailingId}`);
    sailing.takeForBooking(bookingId, seats);
    this.sailings.save(sailing);
  }
}
