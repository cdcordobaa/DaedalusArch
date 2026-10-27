import type { GuestRepository } from '../domain/guest/GuestRepository';
import { GuestId } from '../domain/guest/value-objects/GuestId';

/** The host adds past visits by hand (visits from before the profile existed, corrections). */
export class AddVisits {
  constructor(private readonly guests: GuestRepository) {}

  execute(guestId: string, visits: number): void {
    const guest = this.guests.byId(GuestId.of(guestId));
    if (guest === undefined) throw new Error(`no guest ${guestId}`);
    guest.addVisits(visits);
    this.guests.save(guest);
  }
}
