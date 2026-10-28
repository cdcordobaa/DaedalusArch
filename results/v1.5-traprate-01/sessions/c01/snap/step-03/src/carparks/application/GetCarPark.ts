import type { CarParkView } from '../contracts/CarParkView';
import type { CarParkRepository } from '../domain/carpark/CarParkRepository';
import { CarParkId } from '../domain/carpark/value-objects/CarParkId';

export class GetCarPark {
  constructor(private readonly carParks: CarParkRepository) {}

  execute(carParkId: string): CarParkView | undefined {
    const carPark = this.carParks.byId(CarParkId.of(carParkId));
    if (carPark === undefined) return undefined;
    return { id: carPark.id.value, name: carPark.name, bays: carPark.bays, baysFree: carPark.baysFree(), closed: carPark.isClosed() };
  }
}
