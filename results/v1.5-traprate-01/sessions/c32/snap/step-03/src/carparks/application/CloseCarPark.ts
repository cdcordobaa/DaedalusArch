import { CarParkError } from '../domain/CarParkError';
import type { CarParkRepository } from '../domain/carpark/CarParkRepository';
import { CarParkId } from '../domain/carpark/value-objects/CarParkId';

export class CloseCarPark {
  constructor(private readonly carParks: CarParkRepository) {}

  execute(carParkId: string): void {
    const carPark = this.carParks.byId(CarParkId.of(carParkId));
    if (carPark === undefined) throw new CarParkError(`no car park ${carParkId}`);
    carPark.close();
    this.carParks.save(carPark);
  }
}
