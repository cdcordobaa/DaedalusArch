import type { SailingsModule } from '../../sailings';
import type { SailingDirectory } from '../application/ports/SailingDirectory';

/** Translates the sailings module's published calls into what bookings need. */
export class SailingsDirectory implements SailingDirectory {
  constructor(private readonly sailings: SailingsModule) {}

  exists(sailingId: string): boolean {
    return this.sailings.sailing(sailingId) !== undefined;
  }

  isCancelled(sailingId: string): boolean {
    return this.sailings.sailing(sailingId)?.cancelled === true;
  }

  takeSeats(sailingId: string, bookingId: string, seats: number): boolean {
    const sailing = this.sailings.sailing(sailingId);
    if (sailing === undefined || sailing.cancelled || sailing.seatsLeft < seats) return false;
    this.sailings.holdSeats(sailingId, `booking:${bookingId}`, seats);
    return true;
  }

  releaseSeats(sailingId: string, bookingId: string): void {
    this.sailings.releaseSeats(sailingId, `booking:${bookingId}`);
  }
}
