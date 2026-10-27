import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { SpaceError } from '../SpaceError';
import type { CalendarChange } from './CalendarChange';
import { ReservationRelocated } from './events/ReservationRelocated';
import { RoomOpened } from './events/RoomOpened';
import type { Reservation } from './Reservation';
import type { RoomId } from './value-objects/RoomId';
import type { TimeSlot } from './value-objects/TimeSlot';

/** Minutes one team may hold this room on one day once a relocated reservation is added. */
export const TEAM_CAP_MINUTES = 240;

export interface RoomState {
  readonly id: RoomId;
  readonly name: string;
  readonly site: string;
  readonly seats: number;
  readonly reservations: readonly Reservation[];
  readonly released: readonly string[];
  readonly changes: readonly CalendarChange[];
}

/**
 * A meeting room at one coworking site. Its reservations never overlap in time, never need more people than it seats,
 * and each reservation is held once; a reservation relocated into it keeps its team within the daily team cap.
 */
export class Room {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: RoomId,
    readonly name: string,
    readonly site: string,
    readonly seats: number,
    private held: Reservation[],
    private released: string[],
    private changes: CalendarChange[],
  ) {}

  static open(id: RoomId, name: string, site: string, seats: number): Room {
    if (name.trim() === '' || site.trim() === '') throw new SpaceError('a room needs a name and a site');
    if (!Number.isInteger(seats) || seats < 1) throw new SpaceError('a room seats at least one person');
    const room = new Room(id, name, site, seats, [], [], []);
    room.pending.push(new RoomOpened(id.value, name, site, seats));
    return room;
  }

  static restore(state: RoomState): Room {
    return new Room(state.id, state.name, state.site, state.seats, [...state.reservations], [...state.released], [...state.changes]);
  }

  /** Reservations in start order. */
  reservations(): Reservation[] {
    return [...this.held].sort((x, y) => x.slot.startMinute - y.slot.startMinute);
  }

  holds(reservationId: string): boolean {
    return this.held.some((r) => r.id === reservationId);
  }

  /** The reservation this room holds under that id; refuses when it holds none. */
  reservation(reservationId: string): Reservation {
    const found = this.held.find((r) => r.id === reservationId);
    if (found === undefined) throw new SpaceError(`${reservationId} is not in ${this.id.value}`);
    return found;
  }

  reserve(reservationId: string, teamId: string, people: number, slot: TimeSlot): void {
    this.admit(reservationId, teamId, people, slot);
    this.held.push({ id: reservationId, teamId, people, slot });
    this.changes.push({ kind: 'reserved', reservationId, otherRoom: null });
  }

  cancel(reservationId: string): void {
    this.reservation(reservationId);
    this.held = this.held.filter((r) => r.id !== reservationId);
    this.changes.push({ kind: 'cancelled', reservationId, otherRoom: null });
  }

  /** Takes over a reservation from another room of the same site; that room releases it when the event is delivered. */
  takeOverReservation(relocationId: string, reservation: Reservation, from: RoomId, fromSite: string): void {
    if (from.equals(this.id)) throw new SpaceError('a relocation needs two different rooms');
    if (fromSite !== this.site) throw new SpaceError(`site mismatch: ${fromSite} to ${this.site}`);
    this.admit(reservation.id, reservation.teamId, reservation.people, reservation.slot);
    const used = this.minutesOf(reservation.teamId, reservation.slot.day);
    if (used + reservation.slot.minutes > TEAM_CAP_MINUTES) {
      const left = Math.max(0, TEAM_CAP_MINUTES - used) / 60;
      throw new SpaceError(`team cap reached: ${reservation.teamId} has ${left.toFixed(2)} h left in ${this.id.value} on ${reservation.slot.day}`);
    }
    this.held.push(reservation);
    this.changes.push({ kind: 'relocated-in', reservationId: reservation.id, otherRoom: from.value });
    this.pending.push(new ReservationRelocated(relocationId, reservation.id, from.value, this.id.value));
  }

  /** Releases a reservation another room took over, once per relocation whatever the number of deliveries. */
  releaseRelocated(relocationId: string, reservationId: string, to: RoomId): void {
    if (this.released.includes(relocationId)) return;
    this.released.push(relocationId);
    this.held = this.held.filter((r) => r.id !== reservationId);
    this.changes.push({ kind: 'relocated-out', reservationId, otherRoom: to.value });
  }

  history(): CalendarChange[] {
    return [...this.changes].reverse();
  }

  state(): RoomState {
    return {
      id: this.id, name: this.name, site: this.site, seats: this.seats, reservations: [...this.held],
      released: [...this.released], changes: [...this.changes],
    };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }

  private admit(reservationId: string, teamId: string, people: number, slot: TimeSlot): void {
    if (teamId.trim() === '') throw new SpaceError('a team id must not be empty');
    if (!Number.isInteger(people) || people < 1) throw new SpaceError('a reservation is for at least one person');
    if (this.holds(reservationId)) throw new SpaceError(`${reservationId} is already in ${this.id.value}`);
    if (people > this.seats) throw new SpaceError(`room too small: ${this.id.value} seats ${String(this.seats)}, the reservation needs ${String(people)}`);
    const clash = this.held.find((r) => r.slot.overlaps(slot));
    if (clash !== undefined) throw new SpaceError(`room not free: ${this.id.value} has ${clash.id} from ${clash.slot.start} to ${clash.slot.end}`);
  }

  private minutesOf(teamId: string, day: string): number {
    return this.held.filter((r) => r.teamId === teamId && r.slot.day === day).reduce((sum, r) => sum + r.slot.minutes, 0);
  }
}
