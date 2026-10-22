import { SailingError } from '../domain/SailingError';
import type { SailingRepository } from '../domain/sailing/SailingRepository';
import { SailingId } from '../domain/sailing/value-objects/SailingId';

/** Takes the seats a booking asks for, or none, and announces which. */
export class ReserveSeats {
  constructor(private readonly sailings: SailingRepository) {}

  execute(sailingId: string, bookingId: string, seats: number): void {
    const sailing = this.sailings.byId(SailingId.of(sailingId));
    if (sailing === undefined) throw new SailingError(`no sailing ${sailingId}`);
    sailing.reserve(bookingId, seats);
    this.sailings.save(sailing);
  }
}
