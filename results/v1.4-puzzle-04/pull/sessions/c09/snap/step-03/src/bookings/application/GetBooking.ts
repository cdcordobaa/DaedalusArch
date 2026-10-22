import type { BookingView } from '../contracts/BookingView';
import type { BookingRepository } from '../domain/booking/BookingRepository';
import { BookingId } from '../domain/booking/value-objects/BookingId';
import type { SailingDirectory } from './ports/SailingDirectory';

export class GetBooking {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly sailings: SailingDirectory,
  ) {}

  execute(bookingId: string): BookingView | undefined {
    const booking = this.bookings.byId(BookingId.of(bookingId));
    if (booking === undefined) return undefined;
    const cancelled = booking.status === 'confirmed' && this.sailings.isCancelled(booking.sailingId);
    const status = cancelled ? 'sailing-cancelled' : booking.status;
    return { id: booking.id.value, passenger: booking.passenger, sailingId: booking.sailingId, seats: booking.seats, status };
  }
}
