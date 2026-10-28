import { ReservationError } from '../domain/ReservationError';
import type { ReservationRepository } from '../domain/reservation/ReservationRepository';
import { ReservationId } from '../domain/reservation/value-objects/ReservationId';
import type { CarParkDirectory } from './ports/CarParkDirectory';

export class CancelReservation {
  constructor(
    private readonly reservations: ReservationRepository,
    private readonly carParks: CarParkDirectory,
  ) {}

  execute(reservationId: string): void {
    const reservation = this.reservations.byId(ReservationId.of(reservationId));
    if (reservation === undefined) throw new ReservationError(`no reservation ${reservationId}`);
    if (reservation.status === 'cancelled' || reservation.status === 'rejected') return;
    if (reservation.status === 'confirmed') this.carParks.returnBays(reservation.carParkId, `reservation:${reservation.id.value}`);
    reservation.cancel();
    this.reservations.save(reservation);
  }
}
