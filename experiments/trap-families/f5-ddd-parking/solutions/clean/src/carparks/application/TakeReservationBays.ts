import type { CarParkRepository } from '../domain/carpark/CarParkRepository';
import { CarParkId } from '../domain/carpark/value-objects/CarParkId';

/** Handles a reservation's request for bays in a car park. */
export class TakeReservationBays {
  constructor(private readonly carParks: CarParkRepository) {}

  execute(reservationId: string, carParkId: string, bays: number): void {
    const carPark = this.carParks.byId(CarParkId.of(carParkId));
    if (carPark === undefined) return;
    carPark.holdForReservation(reservationId, bays);
    this.carParks.save(carPark);
  }
}
