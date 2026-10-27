import { ReservationError } from '../domain/ReservationError';
import type { ReservationRepository } from '../domain/reservation/ReservationRepository';
import { ReservationId } from '../domain/reservation/value-objects/ReservationId';

export class CancelReservation {
  constructor(private readonly reservations: ReservationRepository) {}

  execute(reservationId: string): void {
    const reservation = this.reservations.byId(ReservationId.of(reservationId));
    if (reservation === undefined) throw new ReservationError(`no reservation ${reservationId}`);
    reservation.cancel();
    this.reservations.save(reservation);
  }
}
