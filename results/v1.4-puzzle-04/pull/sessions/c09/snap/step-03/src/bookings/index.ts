import { CancelBooking } from './application/CancelBooking';
import { GetBooking } from './application/GetBooking';
import { RequestBooking } from './application/RequestBooking';
import { SettleBooking } from './application/SettleBooking';
import type { SailingDirectory } from './application/ports/SailingDirectory';
import type { BookingView } from './contracts/BookingView';
import type { BookingRepository } from './domain/booking/BookingRepository';

export type { BookingView } from './contracts/BookingView';

/** What the rest of the system may call. */
export interface BookingsModule {
  book(passenger: string, sailingId: string, seats: number): string;
  booking(bookingId: string): BookingView | undefined;
  settle(bookingId: string, seatsTaken: boolean): void;
  cancel(bookingId: string): void;
}

export function createBookings(bookings: BookingRepository, sailings: SailingDirectory): BookingsModule {
  return {
    book: (passenger, sailingId, seats) => new RequestBooking(bookings, sailings).execute(passenger, sailingId, seats),
    booking: (bookingId) => new GetBooking(bookings, sailings).execute(bookingId),
    cancel: (bookingId) => new CancelBooking(bookings).execute(bookingId),
    settle: (bookingId, seatsTaken) => new SettleBooking(bookings).execute(bookingId, seatsTaken),
  };
}
