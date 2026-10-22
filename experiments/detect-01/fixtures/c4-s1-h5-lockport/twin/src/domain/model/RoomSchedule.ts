import { Booking } from './Booking';
import { DateRange } from './DateRange';

/** Aggregate root: the bookings of one room. No two active bookings of the room overlap. */
export class RoomSchedule {
  constructor(readonly roomId: string, private readonly bookings: Booking[], readonly version: number) {}

  book(id: string, stay: DateRange): Booking {
    if (this.bookings.some((b) => b.isActive() && b.stay.overlaps(stay))) throw new Error(`Room ${this.roomId} is already booked`);
    const booking = new Booking(id, this.roomId, stay);
    this.bookings.push(booking);
    return booking;
  }
}
