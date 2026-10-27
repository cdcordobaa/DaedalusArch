import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { CarRepository } from '../domain/car/CarRepository';
import type { BookingMoved } from '../domain/car/events/BookingMoved';
import { CarId } from '../domain/car/value-objects/CarId';
import { FleetError } from '../domain/FleetError';

export class ReleaseMovedBooking {
  constructor(private readonly cars: CarRepository) {}

  handle(event: DomainEvent): void {
    const moved = event as BookingMoved;
    const source = this.cars.byId(CarId.of(moved.fromCarId));
    if (source === undefined) throw new FleetError(`no car ${moved.fromCarId}`);
    source.releaseMovedBooking(moved.moveId, moved.bookingId, CarId.of(moved.toCarId));
    this.cars.save(source);
  }
}
