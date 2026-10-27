import type { GuestRepository } from '../domain/guest/GuestRepository';
import { GuestId } from '../domain/guest/value-objects/GuestId';

/** Credits a guest with the visit of a stored completed reservation, once per reservation. */
export class RecordVisit {
  constructor(private readonly guests: GuestRepository) {}

  execute(guestId: string, reservationId: string): void {
    const guest = this.guests.byId(GuestId.of(guestId));
    if (guest === undefined) return;
    guest.creditVisit(reservationId);
    this.guests.save(guest);
  }
}
