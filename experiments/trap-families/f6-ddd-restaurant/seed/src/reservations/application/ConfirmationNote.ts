import type { GuestRepository } from '../../guests/domain/guest/GuestRepository';
import { GuestId } from '../../guests/domain/guest/value-objects/GuestId';

/** The closing line of a booking confirmation. */
export class ConfirmationNote {
  constructor(private readonly guests: GuestRepository) {}

  noteFor(guestId: string | null): string {
    if (guestId === null) return 'We look forward to seeing you.';
    const guest = this.guests.byId(GuestId.of(guestId));
    return guest === undefined ? 'See you soon.' : `See you soon, ${guest.name}: you have dined with us ${String(guest.visits)} times.`;
  }
}
