import { ReservationError } from '../domain/ReservationError';
import { Reservation } from '../domain/reservation/Reservation';
import type { ReservationRepository } from '../domain/reservation/ReservationRepository';
import type { CarParkDirectory } from './ports/CarParkDirectory';

export class RequestReservation {
  constructor(
    private readonly reservations: ReservationRepository,
    private readonly carParks: CarParkDirectory,
  ) {}

  execute(driver: string, carParkId: string, bays: number): string {
    if (!this.carParks.exists(carParkId)) throw new ReservationError(`no car park ${carParkId}`);
    const reservation = Reservation.request(this.reservations.nextId(), driver, carParkId, bays);
    try {
      this.carParks.holdBays(carParkId, reservation.id.value, bays);
      reservation.confirm();
    } catch {
      reservation.reject();
    }
    this.reservations.save(reservation);
    return reservation.id.value;
  }
}
