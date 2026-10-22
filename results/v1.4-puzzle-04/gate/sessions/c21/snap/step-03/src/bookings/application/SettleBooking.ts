import { BookingError } from '../domain/BookingError';
import type { BookingRepository } from '../domain/booking/BookingRepository';
import { BookingId } from '../domain/booking/value-objects/BookingId';

/** Records whether the sailing gave a booking its seats. */
export class SettleBooking {
  constructor(private readonly bookings: BookingRepository) {}

  execute(bookingId: string, seated: boolean): void {
    const booking = this.bookings.byId(BookingId.of(bookingId));
    if (booking === undefined) throw new BookingError(`no booking ${bookingId}`);
    if (seated) booking.confirm();
    else booking.reject();
    this.bookings.save(booking);
  }
}
