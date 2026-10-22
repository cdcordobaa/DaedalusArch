import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { BookingRequested } from '../domain/booking/events/BookingRequested';
import type { DeskNotices } from './ports/DeskNotices';

/** Tells the booking desk about every new booking. */
export class NotifyDesk {
  constructor(private readonly notices: DeskNotices) {}

  handle(event: DomainEvent): void {
    const requested = event as BookingRequested;
    this.notices.add(`Booking ${requested.bookingId}: ${String(requested.seats)} seat(s) on ${requested.sailingId} for ${requested.passenger}`);
  }
}
