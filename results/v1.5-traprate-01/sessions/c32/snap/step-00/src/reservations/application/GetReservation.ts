import type { ReservationView } from '../contracts/ReservationView';
import type { ReservationRepository } from '../domain/reservation/ReservationRepository';
import { ReservationId } from '../domain/reservation/value-objects/ReservationId';

export class GetReservation {
  constructor(private readonly reservations: ReservationRepository) {}

  execute(reservationId: string): ReservationView | undefined {
    const reservation = this.reservations.byId(ReservationId.of(reservationId));
    if (reservation === undefined) return undefined;
    return { id: reservation.id.value, driver: reservation.driver, carParkId: reservation.carParkId, bays: reservation.bays, status: reservation.status };
  }
}
