import type { SailingRepository } from '../domain/sailing/SailingRepository';
import { SailingId } from '../domain/sailing/value-objects/SailingId';

/** Handles a booking's request for seats on a sailing. */
export class TakeBookingSeats {
  constructor(private readonly sailings: SailingRepository) {}

  execute(bookingId: string, sailingId: string, seats: number): void {
    const sailing = this.sailings.byId(SailingId.of(sailingId));
    if (sailing === undefined) return;
    sailing.holdForBooking(bookingId, seats);
    this.sailings.save(sailing);
  }
}
