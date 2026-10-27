import type { GuestRepository } from '../../guests/domain/guest/GuestRepository';
import { GuestId } from '../../guests/domain/guest/value-objects/GuestId';
import type { ReservationRepository } from '../domain/reservation/ReservationRepository';
import { ReservationId } from '../domain/reservation/value-objects/ReservationId';

/** The host marks a reservation completed. Refused: an unknown reservation, or one already completed. */
export class CompleteReservation {
  constructor(
    private readonly reservations: ReservationRepository,
    private readonly guests: GuestRepository,
  ) {}

  execute(reservationId: string): void {
    const reservation = this.reservations.byId(ReservationId.of(reservationId));
    if (reservation === undefined) throw new Error(`no reservation ${reservationId}`);
    reservation.complete();
    this.reservations.save(reservation);
    const guest = reservation.guestId === null ? undefined : this.guests.byId(GuestId.of(reservation.guestId));
    if (guest !== undefined) {
      guest.addVisits(1);
      this.guests.save(guest);
    }
  }
}
