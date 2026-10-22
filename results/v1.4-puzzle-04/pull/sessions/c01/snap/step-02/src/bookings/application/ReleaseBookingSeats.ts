import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { BookingCancelled } from '../domain/booking/events/BookingCancelled';
import type { SailingDirectory } from './ports/SailingDirectory';

/** Reacts to a cancelled booking: gives its seats back to the sailing. */
export class ReleaseBookingSeats {
  constructor(private readonly sailings: SailingDirectory) {}

  handle(event: DomainEvent): void {
    const cancelled = event as BookingCancelled;
    this.sailings.releaseSeats(cancelled.sailingId, cancelled.bookingId);
  }
}
