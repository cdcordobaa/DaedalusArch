import { BookingView } from './BookingView';

export interface CancelBooking {
  cancel(bookingId: string): Promise<BookingView>;
}
