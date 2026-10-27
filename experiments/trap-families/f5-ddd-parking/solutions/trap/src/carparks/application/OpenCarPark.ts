import { CarPark } from '../domain/carpark/CarPark';
import type { CarParkRepository } from '../domain/carpark/CarParkRepository';

export class OpenCarPark {
  constructor(private readonly carParks: CarParkRepository) {}

  execute(name: string, bays: number): string {
    const carPark = CarPark.open(this.carParks.nextId(), name, bays);
    this.carParks.save(carPark);
    return carPark.id.value;
  }
}
