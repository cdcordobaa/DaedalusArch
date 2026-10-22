import type { SailingsModule } from '../../sailings';
import type { SailingDirectory } from '../application/ports/SailingDirectory';

/** Translates the sailings module's published calls into what bookings need. */
export class SailingsDirectory implements SailingDirectory {
  constructor(private readonly sailings: SailingsModule) {}

  exists(sailingId: string): boolean {
    return this.sailings.sailing(sailingId) !== undefined;
  }

  take(sailingId: string, holder: string, seats: number): boolean {
    const sailing = this.sailings.sailing(sailingId);
    if (sailing === undefined || sailing.seatsLeft < seats) return false;
    this.sailings.holdSeats(sailingId, holder, seats);
    return true;
  }
}
