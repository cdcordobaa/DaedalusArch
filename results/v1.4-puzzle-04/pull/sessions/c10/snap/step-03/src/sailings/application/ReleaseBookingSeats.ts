import { SailingError } from '../domain/SailingError';
import type { SailingRepository } from '../domain/sailing/SailingRepository';
import { SailingId } from '../domain/sailing/value-objects/SailingId';

/** A cancelled booking gives its seats back. */
export class ReleaseBookingSeats {
  constructor(private readonly sailings: SailingRepository) {}

  execute(sailingId: string, bookingId: string): void {
    const sailing = this.sailings.byId(SailingId.of(sailingId));
    if (sailing === undefined) throw new SailingError(`no sailing ${sailingId}`);
    sailing.releaseBooking(bookingId);
    this.sailings.save(sailing);
  }
}
