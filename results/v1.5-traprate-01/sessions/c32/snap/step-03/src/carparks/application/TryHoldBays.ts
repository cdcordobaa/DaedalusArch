import { CarParkError } from '../domain/CarParkError';
import type { CarParkRepository } from '../domain/carpark/CarParkRepository';
import { CarParkId } from '../domain/carpark/value-objects/CarParkId';

/** Holds bays if enough are free; answers whether it did. */
export class TryHoldBays {
  constructor(private readonly carParks: CarParkRepository) {}

  execute(carParkId: string, holder: string, bays: number): boolean {
    const carPark = this.carParks.byId(CarParkId.of(carParkId));
    if (carPark === undefined) throw new CarParkError(`no car park ${carParkId}`);
    if (!carPark.tryHold(holder, bays)) return false;
    this.carParks.save(carPark);
    return true;
  }
}
