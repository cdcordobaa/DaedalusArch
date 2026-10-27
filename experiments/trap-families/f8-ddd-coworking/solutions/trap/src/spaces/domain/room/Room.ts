import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { SpaceError } from '../SpaceError';
import { RoomOpened } from './events/RoomOpened';
import type { Reservation } from './Reservation';
import type { RoomId } from './value-objects/RoomId';
import type { TimeSlot } from './value-objects/TimeSlot';

export interface CalendarChange {
  readonly kind: string;
  readonly reservationId: string;
  readonly otherRoom: string | null;
}

export interface RoomState {
  readonly id: RoomId;
  readonly name: string;
  readonly site: string;
  readonly seats: number;
  readonly reservations: readonly Reservation[];
  readonly changes?: readonly CalendarChange[];
}

/**
 * A meeting room at one coworking site. Its reservations never overlap in time, never need more people than it seats,
 * and each reservation is held once.
 */
export class Room {
  private pending: DomainEvent[] = [];
  private changes: CalendarChange[] = [];

  private constructor(
    readonly id: RoomId,
    readonly name: string,
    readonly site: string,
    readonly seats: number,
    private held: Reservation[],
  ) {}

  static open(id: RoomId, name: string, site: string, seats: number): Room {
    if (name.trim() === '' || site.trim() === '') throw new SpaceError('a room needs a name and a site');
    if (!Number.isInteger(seats) || seats < 1) throw new SpaceError('a room seats at least one person');
    const room = new Room(id, name, site, seats, []);
    room.pending.push(new RoomOpened(id.value, name, site, seats));
    return room;
  }

  static restore(state: RoomState): Room {
    const room = new Room(state.id, state.name, state.site, state.seats, [...state.reservations]);
    room.changes = [...(state.changes ?? [])];
    return room;
  }

  /** Reservations in start order. */
  reservations(): Reservation[] {
    return [...this.held].sort((x, y) => x.slot.startMinute - y.slot.startMinute);
  }

  holds(reservationId: string): boolean {
    return this.held.some((r) => r.id === reservationId);
  }

  reserve(reservationId: string, teamId: string, people: number, slot: TimeSlot, kind = 'reserved', otherRoom: string | null = null): void {
    if (teamId.trim() === '') throw new SpaceError('a team id must not be empty');
    if (!Number.isInteger(people) || people < 1) throw new SpaceError('a reservation is for at least one person');
    if (this.holds(reservationId)) throw new SpaceError(`${reservationId} is already in ${this.id.value}`);
    if (people > this.seats) throw new SpaceError(`room too small: ${this.id.value} seats ${String(this.seats)}, the reservation needs ${String(people)}`);
    const clash = this.held.find((r) => r.slot.overlaps(slot));
    if (clash !== undefined) throw new SpaceError(`room not free: ${this.id.value} has ${clash.id} from ${clash.slot.start} to ${clash.slot.end}`);
    this.held.push({ id: reservationId, teamId, people, slot });
    this.changes.push({ kind, reservationId, otherRoom });
  }

  cancel(reservationId: string, kind = 'cancelled', otherRoom: string | null = null): void {
    if (!this.holds(reservationId)) throw new SpaceError(`${reservationId} is not in ${this.id.value}`);
    this.held = this.held.filter((r) => r.id !== reservationId);
    this.changes.push({ kind, reservationId, otherRoom });
  }

  history(): CalendarChange[] {
    return [...this.changes].reverse();
  }

  state(): RoomState {
    return { id: this.id, name: this.name, site: this.site, seats: this.seats, reservations: [...this.held], changes: [...this.changes] };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
