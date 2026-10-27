import type { ReservationView } from '../contracts/ReservationView';
import type { ReservationRepository } from '../domain/reservation/ReservationRepository';
import { ReservationId } from '../domain/reservation/value-objects/ReservationId';
import type { CarParkDirectory } from './ports/CarParkDirectory';

export class GetReservation {
  constructor(
    private readonly reservations: ReservationRepository,
    private readonly carParks: CarParkDirectory,
  ) {}

  execute(reservationId: string): ReservationView | undefined {
    const reservation = this.reservations.byId(ReservationId.of(reservationId));
    if (reservation === undefined) return undefined;
    return { id: reservation.id.value, driver: reservation.driver, carParkId: reservation.carParkId, bays: reservation.bays, status: reservation.status === 'confirmed' && this.carParks.isClosed(reservation.carParkId) ? 'car-park-closed' : reservation.status };
  }
}
