import type { CarRepository } from '../domain/car/CarRepository';
import { CarId } from '../domain/car/value-objects/CarId';
import { FleetError } from '../domain/FleetError';

export interface LogLine {
  readonly kind: string;
  readonly bookingId: string;
  readonly otherCar: string | null;
}

export class GetLog {
  constructor(private readonly cars: CarRepository) {}

  execute(carId: string): LogLine[] {
    const car = this.cars.byId(CarId.of(carId));
    if (car === undefined) throw new FleetError(`no car ${carId}`);
    return car.log().map((c) => ({ kind: c.kind, bookingId: c.bookingId, otherCar: c.otherCar }));
  }
}
