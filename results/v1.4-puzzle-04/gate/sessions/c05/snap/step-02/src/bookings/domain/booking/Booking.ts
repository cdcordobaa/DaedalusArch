import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { BookingError } from '../BookingError';
import { BookingCancelled } from './events/BookingCancelled';
import { BookingRequested } from './events/BookingRequested';
import type { BookingId } from './value-objects/BookingId';

export type BookingStatus = 'requested' | 'confirmed' | 'rejected' | 'cancelled';

/** Seats one passenger asks for on one sailing. */
const MAX_SEATS = 9;

export interface BookingState {
  readonly id: BookingId;
  readonly passenger: string;
  readonly sailingId: string;
  readonly seats: number;
  readonly status: BookingStatus;
}

/** A passenger's booking on one sailing: 1 to 9 seats. */
export class Booking {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: BookingId,
    readonly passenger: string,
    readonly sailingId: string,
    readonly seats: number,
    private current: BookingStatus,
  ) {}

  static request(id: BookingId, passenger: string, sailingId: string, seats: number): Booking {
    if (passenger.trim() === '') throw new BookingError('a booking needs a passenger name');
    if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) throw new BookingError(`a booking is for 1 to ${String(MAX_SEATS)} seats`);
    const booking = new Booking(id, passenger, sailingId, seats, 'requested');
    booking.pending.push(new BookingRequested(id.value, sailingId, passenger, seats));
    return booking;
  }

  static restore(state: BookingState): Booking {
    return new Booking(state.id, state.passenger, state.sailingId, state.seats, state.status);
  }

  confirm(): void {
    if (this.current !== 'requested') throw new BookingError(`booking is already ${this.current}`);
    this.current = 'confirmed';
  }

  reject(): void {
    if (this.current !== 'requested') throw new BookingError(`booking is already ${this.current}`);
    this.current = 'rejected';
  }

  /** Returns false, changing nothing, if the booking is already cancelled or was rejected. */
  cancel(): boolean {
    if (this.current === 'cancelled' || this.current === 'rejected') return false;
    if (this.current === 'confirmed') this.pending.push(new BookingCancelled(this.id.value, this.sailingId));
    this.current = 'cancelled';
    return true;
  }

  get status(): BookingStatus {
    return this.current;
  }

  state(): BookingState {
    return { id: this.id, passenger: this.passenger, sailingId: this.sailingId, seats: this.seats, status: this.current };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
