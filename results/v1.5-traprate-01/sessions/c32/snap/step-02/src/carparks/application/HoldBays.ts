import { CarParkError } from '../domain/CarParkError';
import type { CarParkRepository } from '../domain/carpark/CarParkRepository';
import { CarParkId } from '../domain/carpark/value-objects/CarParkId';

/** The contracts desk holds a block of bays for a company (staff parking, event crews). */
export class HoldBays {
  constructor(private readonly carParks: CarParkRepository) {}

  execute(carParkId: string, holder: string, bays: number): void {
    const carPark = this.carParks.byId(CarParkId.of(carParkId));
    if (carPark === undefined) throw new CarParkError(`no car park ${carParkId}`);
    carPark.hold(holder, bays);
    this.carParks.save(carPark);
  }
}
