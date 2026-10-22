import type { SailingsModule } from '../../sailings';
import type { SailingDirectory } from '../application/ports/SailingDirectory';

/** Translates the sailings module's published calls into what bookings need. */
export class SailingsDirectory implements SailingDirectory {
  constructor(private readonly sailings: SailingsModule) {}

  isCancelled(sailingId: string): boolean {
    return this.sailings.sailing(sailingId)?.cancelled === true;
  }

  exists(sailingId: string): boolean {
    return this.sailings.sailing(sailingId) !== undefined;
  }}
