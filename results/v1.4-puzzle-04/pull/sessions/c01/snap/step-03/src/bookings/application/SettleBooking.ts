import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { BookingRepository } from '../domain/booking/BookingRepository';
import type { BookingRequested } from '../domain/booking/events/BookingRequested';
import { BookingId } from '../domain/booking/value-objects/BookingId';
import type { SailingDirectory } from './ports/SailingDirectory';

/** Reacts to a requested booking: takes its seats on the sailing, then confirms or rejects the booking. */
export class SettleBooking {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly sailings: SailingDirectory,
  ) {}

  handle(event: DomainEvent): void {
    const requested = event as BookingRequested;
    const booking = this.bookings.byId(BookingId.of(requested.bookingId));
    if (booking === undefined || booking.status !== 'requested') return;
    if (this.sailings.takeSeats(booking.sailingId, booking.id.value, booking.seats)) booking.confirm();
    else booking.reject();
    this.bookings.save(booking);
  }
}
