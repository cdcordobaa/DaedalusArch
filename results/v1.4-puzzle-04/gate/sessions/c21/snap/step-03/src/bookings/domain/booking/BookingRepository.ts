import type { Booking } from './Booking';
import type { BookingId } from './value-objects/BookingId';

export interface BookingRepository {
  nextId(): BookingId;
  byId(id: BookingId): Booking | undefined;
  bySailing(sailingId: string): Booking[];
  /** Stores the booking and its pending events in one step. */
  save(booking: Booking): void;
}
