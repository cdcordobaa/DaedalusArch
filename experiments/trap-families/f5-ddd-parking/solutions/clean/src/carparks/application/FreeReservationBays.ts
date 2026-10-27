import type { CarParkRepository } from '../domain/carpark/CarParkRepository';
import { CarParkId } from '../domain/carpark/value-objects/CarParkId';

/** Handles a cancelled reservation: its bays are free again. */
export class FreeReservationBays {
  constructor(private readonly carParks: CarParkRepository) {}

  execute(reservationId: string, carParkId: string): void {
    const carPark = this.carParks.byId(CarParkId.of(carParkId));
    if (carPark === undefined) return;
    carPark.releaseForReservation(reservationId);
    this.carParks.save(carPark);
  }
}
