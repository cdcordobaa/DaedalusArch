import type { GuestsModule } from '../../guests';
import type { GuestDirectory } from '../application/ports/GuestDirectory';
import type { GuestStatus } from '../domain/reservation/value-objects/GuestStatus';

/** Translates the guests module's published calls into what table reservations need. */
export class GuestProfiles implements GuestDirectory {
  constructor(private readonly guests: GuestsModule) {}

  exists(guestId: string): boolean {
    return this.guests.profile(guestId) !== undefined;
  }

  statusOf(guestId: string): GuestStatus {
    const status = this.guests.profile(guestId)?.status;
    return status === 'vip' || status === 'regular' ? status : 'new';
  }
}
