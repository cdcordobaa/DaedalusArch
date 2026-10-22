import type { SailingRepository } from '../domain/sailing/SailingRepository';
import { SailingId } from '../domain/sailing/value-objects/SailingId';

/** Handles a cancelled booking: its seats are free again. */
export class FreeBookingSeats {
  constructor(private readonly sailings: SailingRepository) {}

  execute(bookingId: string, sailingId: string): void {
    const sailing = this.sailings.byId(SailingId.of(sailingId));
    if (sailing === undefined) return;
    sailing.releaseForBooking(bookingId);
    this.sailings.save(sailing);
  }
}
