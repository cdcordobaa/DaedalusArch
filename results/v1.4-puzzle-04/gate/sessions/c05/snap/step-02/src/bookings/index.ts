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
  /** Cancels the booking and frees its seats; does nothing if it is already cancelled or was rejected. */
  cancel(bookingId: string): void;
  /** Confirms the booking if its seats were taken, rejects it if not. */
  settle(bookingId: string, seatsTaken: boolean): void;
}

export function createBookings(bookings: BookingRepository, sailings: SailingDirectory): BookingsModule {
  return {
    book: (passenger, sailingId, seats) => new RequestBooking(bookings, sailings).execute(passenger, sailingId, seats),
    booking: (bookingId) => new GetBooking(bookings).execute(bookingId),
    cancel: (bookingId) => new CancelBooking(bookings).execute(bookingId),
    settle: (bookingId, seatsTaken) => new SettleBooking(bookings).execute(bookingId, seatsTaken),
  };
}
