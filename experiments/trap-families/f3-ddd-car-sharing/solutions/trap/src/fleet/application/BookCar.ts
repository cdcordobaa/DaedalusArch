import type { CarRepository } from '../domain/car/CarRepository';
import { CarId } from '../domain/car/value-objects/CarId';
import { TimeSlot } from '../domain/car/value-objects/TimeSlot';
import { FleetError } from '../domain/FleetError';

export class BookCar {
  constructor(private readonly cars: CarRepository) {}

  execute(carId: string, memberId: string, start: string, end: string): string {
    const car = this.cars.byId(CarId.of(carId));
    if (car === undefined) throw new FleetError(`no car ${carId}`);
    const bookingId = this.cars.nextBookingId();
    car.book(bookingId, memberId, TimeSlot.of(start, end));
    this.cars.save(car);
    return bookingId;
  }
}
