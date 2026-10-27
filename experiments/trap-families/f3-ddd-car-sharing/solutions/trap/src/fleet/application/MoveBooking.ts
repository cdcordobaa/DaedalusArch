import type { CarRepository } from '../domain/car/CarRepository';
import { CarId } from '../domain/car/value-objects/CarId';
import { FleetError } from '../domain/FleetError';

const CLEANING_GAP_MINUTES = 30;

export class MoveBooking {
  constructor(private readonly cars: CarRepository) {}

  execute(bookingId: string, fromCarId: string, toCarId: string): void {
    const from = this.cars.byId(CarId.of(fromCarId));
    const to = this.cars.byId(CarId.of(toCarId));
    if (from === undefined || to === undefined) throw new FleetError(`no car ${from === undefined ? fromCarId : toCarId}`);
    if (from.id.equals(to.id)) throw new FleetError('a move needs two different cars');
    if (from.zone !== to.zone) throw new FleetError(`zone mismatch: ${from.zone} to ${to.zone}`);
    const booking = from.bookings().find((b) => b.id === bookingId);
    if (booking === undefined) throw new FleetError(`${bookingId} is not on ${from.id.value}`);
    const slot = booking.slot;
    const near = to.bookings().find((b) => b.slot.startMinute < slot.endMinute + CLEANING_GAP_MINUTES && slot.startMinute < b.slot.endMinute + CLEANING_GAP_MINUTES);
    if (near !== undefined && !near.slot.overlaps(slot)) {
      throw new FleetError(`no cleaning gap: ${to.id.value} has ${near.id} from ${near.slot.start} to ${near.slot.end}`);
    }
    from.cancel(bookingId, 'moved-out', to.id.value);
    to.book(booking.id, booking.memberId, slot, 'moved-in', from.id.value);
    this.cars.save(from);
    this.cars.save(to);
  }
}
