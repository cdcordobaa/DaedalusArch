import { BookingError } from '../domain/BookingError';
import type { BookingRepository } from '../domain/booking/BookingRepository';
import { BookingId } from '../domain/booking/value-objects/BookingId';

/** A passenger gives up a booking. */
export class CancelBooking {
  constructor(private readonly bookings: BookingRepository) {}

  execute(bookingId: string): void {
    const booking = this.bookings.byId(BookingId.of(bookingId));
    if (booking === undefined) throw new BookingError(`no booking ${bookingId}`);
    booking.cancel();
    this.bookings.save(booking);
  }
}
