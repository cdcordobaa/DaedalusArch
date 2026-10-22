import { BookingError } from '../domain/BookingError';
import type { BookingRepository } from '../domain/booking/BookingRepository';
import { BookingId } from '../domain/booking/value-objects/BookingId';

/** A passenger cancels a booking; the seats are given back when the cancellation event is delivered. */
export class CancelBooking {
  constructor(private readonly bookings: BookingRepository) {}

  execute(bookingId: string): void {
    const booking = this.bookings.byId(BookingId.of(bookingId));
    if (booking === undefined) throw new BookingError(`no booking ${bookingId}`);
    booking.cancel();
    this.bookings.save(booking);
  }
}
