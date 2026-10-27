import type { ReservationRepository } from '../domain/reservation/ReservationRepository';
import { ReservationId } from '../domain/reservation/value-objects/ReservationId';

/** Handles the car park's answer to a reservation's request for bays. */
export class SettleReservation {
  constructor(private readonly reservations: ReservationRepository) {}

  execute(reservationId: string, held: boolean): void {
    const reservation = this.reservations.byId(ReservationId.of(reservationId));
    if (reservation === undefined) return;
    if (held) reservation.confirm();
    else reservation.reject();
    this.reservations.save(reservation);
  }
}
