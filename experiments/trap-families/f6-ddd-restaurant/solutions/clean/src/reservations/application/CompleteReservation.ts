import type { ReservationRepository } from '../domain/reservation/ReservationRepository';
import { ReservationId } from '../domain/reservation/value-objects/ReservationId';

/** The host marks a reservation completed. Refused: an unknown reservation, or one already completed. */
export class CompleteReservation {
  constructor(private readonly reservations: ReservationRepository) {}

  execute(reservationId: string): void {
    const reservation = this.reservations.byId(ReservationId.of(reservationId));
    if (reservation === undefined) throw new Error(`no reservation ${reservationId}`);
    reservation.complete();
    this.reservations.save(reservation);
  }
}
