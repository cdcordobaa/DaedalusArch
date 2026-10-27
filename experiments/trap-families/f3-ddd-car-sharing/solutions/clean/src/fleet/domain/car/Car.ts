import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { FleetError } from '../FleetError';
import type { Booking } from './Booking';
import type { CalendarChange } from './CalendarChange';
import { BookingMoved } from './events/BookingMoved';
import { CarAdded } from './events/CarAdded';
import type { CarId } from './value-objects/CarId';
import type { TimeSlot } from './value-objects/TimeSlot';

/** Minutes a car needs free before and after a booking moved onto it, for cleaning. */
export const CLEANING_GAP_MINUTES = 30;

export interface CarState {
  readonly id: CarId;
  readonly plate: string;
  readonly zone: string;
  readonly bookings: readonly Booking[];
  readonly released: readonly string[];
  readonly changes: readonly CalendarChange[];
}

/**
 * A shared car parked in one zone. Its bookings never overlap in time, each booking is held once, and a booking moved
 * onto it leaves the cleaning gap free on both sides.
 */
export class Car {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: CarId,
    readonly plate: string,
    readonly zone: string,
    private held: Booking[],
    private released: string[],
    private changes: CalendarChange[],
  ) {}

  static add(id: CarId, plate: string, zone: string): Car {
    if (plate.trim() === '' || zone.trim() === '') throw new FleetError('a car needs a plate and a zone');
    const car = new Car(id, plate, zone, [], [], []);
    car.pending.push(new CarAdded(id.value, plate, zone));
    return car;
  }

  static restore(state: CarState): Car {
    return new Car(state.id, state.plate, state.zone, [...state.bookings], [...state.released], [...state.changes]);
  }

  /** Bookings in start order. */
  bookings(): Booking[] {
    return [...this.held].sort((x, y) => x.slot.startMinute - y.slot.startMinute);
  }

  holds(bookingId: string): boolean {
    return this.held.some((b) => b.id === bookingId);
  }

  /** The booking this car holds under that id; refuses when it holds none. */
  booking(bookingId: string): Booking {
    const found = this.held.find((b) => b.id === bookingId);
    if (found === undefined) throw new FleetError(`${bookingId} is not on ${this.id.value}`);
    return found;
  }

  book(bookingId: string, memberId: string, slot: TimeSlot): void {
    this.reserve(bookingId, memberId, slot);
    this.changes.push({ kind: 'booked', bookingId, otherCar: null });
  }

  cancel(bookingId: string): void {
    this.booking(bookingId);
    this.held = this.held.filter((b) => b.id !== bookingId);
    this.changes.push({ kind: 'cancelled', bookingId, otherCar: null });
  }

  /** Takes over a booking from another car of the same zone; that car releases it when the event is delivered. */
  takeOverBooking(moveId: string, booking: Booking, from: CarId, fromZone: string): void {
    if (from.equals(this.id)) throw new FleetError('a move needs two different cars');
    if (fromZone !== this.zone) throw new FleetError(`zone mismatch: ${fromZone} to ${this.zone}`);
    const overlap = this.held.find((b) => b.slot.overlaps(booking.slot));
    if (overlap === undefined) {
      const tooClose = this.held.find((b) => this.withinGap(b.slot, booking.slot));
      if (tooClose !== undefined) {
        throw new FleetError(`no cleaning gap: ${this.id.value} has ${tooClose.id} from ${tooClose.slot.start} to ${tooClose.slot.end}`);
      }
    }
    this.reserve(booking.id, booking.memberId, booking.slot);
    this.changes.push({ kind: 'moved-in', bookingId: booking.id, otherCar: from.value });
    this.pending.push(new BookingMoved(moveId, booking.id, from.value, this.id.value));
  }

  /** Releases a booking another car took over, once per move whatever the number of deliveries. */
  releaseMovedBooking(moveId: string, bookingId: string, to: CarId): void {
    if (this.released.includes(moveId)) return;
    this.released.push(moveId);
    this.held = this.held.filter((b) => b.id !== bookingId);
    this.changes.push({ kind: 'moved-out', bookingId, otherCar: to.value });
  }

  log(): CalendarChange[] {
    return [...this.changes].reverse();
  }

  state(): CarState {
    return {
      id: this.id, plate: this.plate, zone: this.zone, bookings: [...this.held],
      released: [...this.released], changes: [...this.changes],
    };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }

  private reserve(bookingId: string, memberId: string, slot: TimeSlot): void {
    if (memberId.trim() === '') throw new FleetError('a member id must not be empty');
    if (this.holds(bookingId)) throw new FleetError(`${bookingId} is already on ${this.id.value}`);
    const clash = this.held.find((b) => b.slot.overlaps(slot));
    if (clash !== undefined) throw new FleetError(`car not free: ${this.id.value} has ${clash.id} from ${clash.slot.start} to ${clash.slot.end}`);
    this.held.push({ id: bookingId, memberId, slot });
  }

  private withinGap(other: TimeSlot, moved: TimeSlot): boolean {
    return other.startMinute < moved.endMinute + CLEANING_GAP_MINUTES && moved.startMinute < other.endMinute + CLEANING_GAP_MINUTES;
  }
}
