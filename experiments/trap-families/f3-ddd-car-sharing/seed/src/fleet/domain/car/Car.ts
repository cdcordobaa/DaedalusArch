import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { FleetError } from '../FleetError';
import type { Booking } from './Booking';
import { CarAdded } from './events/CarAdded';
import type { CarId } from './value-objects/CarId';
import type { TimeSlot } from './value-objects/TimeSlot';

export interface CarState {
  readonly id: CarId;
  readonly plate: string;
  readonly zone: string;
  readonly bookings: readonly Booking[];
}

/** A shared car parked in one zone. Its bookings never overlap in time, and each booking is held once. */
export class Car {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: CarId,
    readonly plate: string,
    readonly zone: string,
    private held: Booking[],
  ) {}

  static add(id: CarId, plate: string, zone: string): Car {
    if (plate.trim() === '' || zone.trim() === '') throw new FleetError('a car needs a plate and a zone');
    const car = new Car(id, plate, zone, []);
    car.pending.push(new CarAdded(id.value, plate, zone));
    return car;
  }

  static restore(state: CarState): Car {
    return new Car(state.id, state.plate, state.zone, [...state.bookings]);
  }

  /** Bookings in start order. */
  bookings(): Booking[] {
    return [...this.held].sort((x, y) => x.slot.startMinute - y.slot.startMinute);
  }

  holds(bookingId: string): boolean {
    return this.held.some((b) => b.id === bookingId);
  }

  book(bookingId: string, memberId: string, slot: TimeSlot): void {
    if (memberId.trim() === '') throw new FleetError('a member id must not be empty');
    if (this.holds(bookingId)) throw new FleetError(`${bookingId} is already on ${this.id.value}`);
    const clash = this.held.find((b) => b.slot.overlaps(slot));
    if (clash !== undefined) throw new FleetError(`car not free: ${this.id.value} has ${clash.id} from ${clash.slot.start} to ${clash.slot.end}`);
    this.held.push({ id: bookingId, memberId, slot });
  }

  cancel(bookingId: string): void {
    if (!this.holds(bookingId)) throw new FleetError(`${bookingId} is not on ${this.id.value}`);
    this.held = this.held.filter((b) => b.id !== bookingId);
  }

  state(): CarState {
    return { id: this.id, plate: this.plate, zone: this.zone, bookings: [...this.held] };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
