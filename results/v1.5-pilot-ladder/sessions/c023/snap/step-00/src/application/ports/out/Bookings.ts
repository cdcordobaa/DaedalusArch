import type { Booking } from '../../../domain/model/Booking';

export interface Bookings {
  save(booking: Booking): Promise<void>;
  get(bookingId: string): Promise<Booking | null>;
}
