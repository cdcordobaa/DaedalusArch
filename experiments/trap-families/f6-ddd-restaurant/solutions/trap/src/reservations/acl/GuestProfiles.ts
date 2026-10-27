import type { GuestsModule } from '../../guests';
import type { GuestDirectory } from '../application/ports/GuestDirectory';

/** Translates the guests module's published calls into what table reservations need. */
export class GuestProfiles implements GuestDirectory {
  constructor(private readonly guests: GuestsModule) {}

  exists(guestId: string): boolean {
    return this.guests.profile(guestId) !== undefined;
  }
}
