import type { SailingsModule } from '../../sailings';
import type { SailingDirectory } from '../application/ports/SailingDirectory';

/** Translates the sailings module's published calls into what bookings need. */
export class SailingsDirectory implements SailingDirectory {
  constructor(private readonly sailings: SailingsModule) {}

  exists(sailingId: string): boolean {
    return this.sailings.sailing(sailingId) !== undefined;
  }

  releaseSeats(sailingId: string, holder: string): void {
    this.sailings.releaseSeats(sailingId, holder);
  }

  takeSeats(sailingId: string, holder: string, seats: number): boolean {
    try {
      this.sailings.holdSeats(sailingId, holder, seats);
      return true;
    } catch (e) {
      if (e instanceof Error && e.name === 'SailingError' && e.message.startsWith('not enough seats')) return false;
      throw e;
    }
  }
}
