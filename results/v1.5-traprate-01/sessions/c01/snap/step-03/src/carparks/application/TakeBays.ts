import { CarParkError } from '../domain/CarParkError';
import type { CarParkRepository } from '../domain/carpark/CarParkRepository';
import { CarParkId } from '../domain/carpark/value-objects/CarParkId';

/** Takes bays for a holder if enough are free; says whether it did. */
export class TakeBays {
  constructor(private readonly carParks: CarParkRepository) {}

  execute(carParkId: string, holder: string, bays: number): boolean {
    const carPark = this.carParks.byId(CarParkId.of(carParkId));
    if (carPark === undefined) throw new CarParkError(`no car park ${carParkId}`);
    if (!carPark.tryHold(holder, bays)) return false;
    this.carParks.save(carPark);
    return true;
  }
}
