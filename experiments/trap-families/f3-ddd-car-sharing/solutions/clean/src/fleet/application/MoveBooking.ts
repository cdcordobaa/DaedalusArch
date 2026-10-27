import type { CarRepository } from '../domain/car/CarRepository';
import { CarId } from '../domain/car/value-objects/CarId';
import { FleetError } from '../domain/FleetError';

/** Puts the booking on the receiving car; `ReleaseMovedBooking` takes it off the leaving car when the event is delivered. */
export class MoveBooking {
  constructor(private readonly cars: CarRepository) {}

  execute(bookingId: string, fromCarId: string, toCarId: string): string {
    const source = this.cars.byId(CarId.of(fromCarId));
    if (source === undefined) throw new FleetError(`no car ${fromCarId}`);
    const target = this.cars.byId(CarId.of(toCarId));
    if (target === undefined) throw new FleetError(`no car ${toCarId}`);
    const booking = source.booking(bookingId);
    const moveId = this.cars.nextMoveId();
    target.takeOverBooking(moveId, booking, source.id, source.zone);
    this.cars.save(target);
    return moveId;
  }
}
