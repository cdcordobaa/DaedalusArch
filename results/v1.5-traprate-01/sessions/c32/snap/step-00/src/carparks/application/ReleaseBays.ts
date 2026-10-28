import { CarParkError } from '../domain/CarParkError';
import type { CarParkRepository } from '../domain/carpark/CarParkRepository';
import { CarParkId } from '../domain/carpark/value-objects/CarParkId';

/** The contracts desk gives a company's bays back. */
export class ReleaseBays {
  constructor(private readonly carParks: CarParkRepository) {}

  execute(carParkId: string, holder: string): void {
    const carPark = this.carParks.byId(CarParkId.of(carParkId));
    if (carPark === undefined) throw new CarParkError(`no car park ${carParkId}`);
    carPark.release(holder);
    this.carParks.save(carPark);
  }
}
