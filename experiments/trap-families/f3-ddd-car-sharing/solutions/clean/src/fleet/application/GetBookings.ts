import type { CarRepository } from '../domain/car/CarRepository';
import { CarId } from '../domain/car/value-objects/CarId';
import { FleetError } from '../domain/FleetError';

export interface BookingLine {
  readonly bookingId: string;
  readonly memberId: string;
  readonly start: string;
  readonly end: string;
}

export class GetBookings {
  constructor(private readonly cars: CarRepository) {}

  execute(carId: string): BookingLine[] {
    const car = this.cars.byId(CarId.of(carId));
    if (car === undefined) throw new FleetError(`no car ${carId}`);
    return car.bookings().map((b) => ({ bookingId: b.id, memberId: b.memberId, start: b.slot.start, end: b.slot.end }));
  }
}
