import { GetBooking } from './application/GetBooking';
import { RequestBooking } from './application/RequestBooking';
import { ResolveBooking } from './application/ResolveBooking';
import type { SailingDirectory } from './application/ports/SailingDirectory';
import type { BookingView } from './contracts/BookingView';
import type { BookingRepository } from './domain/booking/BookingRepository';

export type { BookingView } from './contracts/BookingView';

/** What the rest of the system may call. */
export interface BookingsModule {
  book(passenger: string, sailingId: string, seats: number): string;
  booking(bookingId: string): BookingView | undefined;
  resolve(bookingId: string, seatsTaken: boolean): void;
}

export function createBookings(bookings: BookingRepository, sailings: SailingDirectory): BookingsModule {
  return {
    book: (passenger, sailingId, seats) => new RequestBooking(bookings, sailings).execute(passenger, sailingId, seats),
    booking: (bookingId) => new GetBooking(bookings).execute(bookingId),
    resolve: (bookingId, seatsTaken) => new ResolveBooking(bookings).execute(bookingId, seatsTaken),
  };
}
