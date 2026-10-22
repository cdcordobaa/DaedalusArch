import type { SailingsModule } from '../../sailings';
import type { SailingDirectory } from '../application/ports/SailingDirectory';
import type { SeatRequests } from '../application/ports/SeatRequests';

/** Translates the sailings module's published calls into what bookings need. */
export class SailingsDirectory implements SailingDirectory, SeatRequests {
  constructor(private readonly sailings: SailingsModule) {}

  exists(sailingId: string): boolean {
    return this.sailings.sailing(sailingId) !== undefined;
  }

  request(bookingId: string, sailingId: string, seats: number): void {
    this.sailings.bookingRequested(bookingId, sailingId, seats);
  }

  isCancelled(sailingId: string): boolean {
    return this.sailings.sailing(sailingId)?.cancelled === true;
  }
}
