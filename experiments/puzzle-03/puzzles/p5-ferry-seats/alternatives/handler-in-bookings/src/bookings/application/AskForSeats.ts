import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { BookingRequested } from '../domain/booking/events/BookingRequested';
import type { SeatRequests } from './ports/SeatRequests';

/** Handler of a stored booking request: asks the sailing for the seats. */
export class AskForSeats {
  constructor(private readonly seats: SeatRequests) {}

  handle(event: DomainEvent): void {
    const requested = event as BookingRequested;
    this.seats.request(requested.bookingId, requested.sailingId, requested.seats);
  }
}
