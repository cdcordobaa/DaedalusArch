import type { CarRepository } from '../domain/car/CarRepository';
import { CarId } from '../domain/car/value-objects/CarId';
import { FleetError } from '../domain/FleetError';

export class CancelBooking {
  constructor(private readonly cars: CarRepository) {}

  execute(carId: string, bookingId: string): void {
    const car = this.cars.byId(CarId.of(carId));
    if (car === undefined) throw new FleetError(`no car ${carId}`);
    car.cancel(bookingId);
    this.cars.save(car);
  }
}
