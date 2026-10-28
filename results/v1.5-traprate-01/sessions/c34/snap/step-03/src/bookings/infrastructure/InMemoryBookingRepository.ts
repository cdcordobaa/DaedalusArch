import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { Outbox } from '../application/ports/Outbox';
import { Booking, type BookingState } from '../domain/booking/Booking';
import type { BookingRepository } from '../domain/booking/BookingRepository';
import { BookingId } from '../domain/booking/value-objects/BookingId';

/** Bookings and their outbox in one store: saving a booking stores its pending events in the same step. */
export class InMemoryBookingRepository implements BookingRepository, Outbox {
  private readonly rows = new Map<string, BookingState>();
  private outbox: DomainEvent[] = [];
  private sequence = 0;

  nextId(): BookingId {
    this.sequence += 1;
    return BookingId.of(`B-${String(this.sequence).padStart(4, '0')}`);
  }

  byId(id: BookingId): Booking | undefined {
    const row = this.rows.get(id.value);
    return row === undefined ? undefined : Booking.restore(row);
  }

  save(booking: Booking): void {
    const events = booking.pullEvents();
    this.rows.set(booking.id.value, booking.state());
    this.outbox = [...this.outbox, ...events];
  }

  takePending(): DomainEvent[] {
    const out = this.outbox;
    this.outbox = [];
    return out;
  }
}
