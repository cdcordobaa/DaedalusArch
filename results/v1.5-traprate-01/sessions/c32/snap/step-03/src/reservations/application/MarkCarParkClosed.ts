import type { ReservationRepository } from '../domain/reservation/ReservationRepository';

/** Each reservation in the closed car park is changed and saved on its own. */
export class MarkCarParkClosed {
  constructor(private readonly reservations: ReservationRepository) {}

  execute(carParkId: string): void {
    for (const reservation of this.reservations.byCarPark(carParkId)) {
      reservation.carParkClosed();
      this.reservations.save(reservation);
    }
  }
}
