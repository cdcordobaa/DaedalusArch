import { BookingError } from '../domain/BookingError';
import { Booking } from '../domain/booking/Booking';
import type { BookingRepository } from '../domain/booking/BookingRepository';
import type { SailingDirectory } from './ports/SailingDirectory';

export class RequestBooking {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly sailings: SailingDirectory,
  ) {}

  execute(passenger: string, sailingId: string, seats: number): string {
    if (!this.sailings.exists(sailingId)) throw new BookingError(`no sailing ${sailingId}`);
    const booking = Booking.request(this.bookings.nextId(), passenger, sailingId, seats);
    if (this.sailings.takeSeats(sailingId, `booking:${booking.id.value}`, seats)) booking.confirm();
    else booking.reject();
    this.bookings.save(booking);
    return booking.id.value;
  }
}
