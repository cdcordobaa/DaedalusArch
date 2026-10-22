import { CancelBooking } from './application/CancelBooking';
import { GetBooking } from './application/GetBooking';
import { RequestBooking } from './application/RequestBooking';
import { SettleBooking } from './application/SettleBooking';
import type { EventPublisher } from './application/ports/EventPublisher';
import type { SailingDirectory } from './application/ports/SailingDirectory';
import type { BookingView } from './contracts/BookingView';
import type { BookingRepository } from './domain/booking/BookingRepository';

export type { BookingView } from './contracts/BookingView';

/** What the rest of the system may call. */
export interface BookingsModule {
  book(passenger: string, sailingId: string, seats: number): string;
  booking(bookingId: string): BookingView | undefined;
  cancel(bookingId: string): void;
  /** Subscribers for the sailing's stored answer to a booking. */
  seatsHeld(bookingId: string): void;
  seatsRefused(bookingId: string): void;
}

export function createBookings(bookings: BookingRepository, sailings: SailingDirectory, events: EventPublisher): BookingsModule {
  return {
    book: (passenger, sailingId, seats) => new RequestBooking(bookings, sailings, events).execute(passenger, sailingId, seats),
    booking: (bookingId) => new GetBooking(bookings, sailings).execute(bookingId),
    cancel: (bookingId) => new CancelBooking(bookings, events).execute(bookingId),
    seatsHeld: (bookingId) => new SettleBooking(bookings).execute(bookingId, true),
    seatsRefused: (bookingId) => new SettleBooking(bookings).execute(bookingId, false),
  };
}
