import { Car } from '../domain/car/Car';
import type { CarRepository } from '../domain/car/CarRepository';

export class AddCar {
  constructor(private readonly cars: CarRepository) {}

  execute(plate: string, zone: string): string {
    const car = Car.add(this.cars.nextId(), plate, zone);
    this.cars.save(car);
    return car.id.value;
  }
}
