import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { Money } from '../../../shared-kernel/Money';
import { ReservationCompleted } from './events/ReservationCompleted';
import { TableBooked } from './events/TableBooked';
import type { ReservationId } from './value-objects/ReservationId';

/** The largest party one reservation seats, and the deposit asked for every seat. */
const LARGEST_PARTY = 8;
const DEPOSIT_PER_SEAT = 12.5;

export interface ReservationState {
  readonly id: ReservationId;
  readonly guestId: string | null;
  readonly partySize: number;
  readonly currency: string;
  readonly completed: boolean;
  readonly waivedShare?: number;
}

/**
 * A table reservation. Refused: a party that is not a whole number from 1 to 8. A reservation is completed once (the
 * party came and has been served); completing it again is refused.
 */
export class Reservation {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: ReservationId,
    readonly guestId: string | null,
    readonly partySize: number,
    readonly currency: string,
    private done: boolean,
    readonly waivedShare = 0,
  ) {}

  static book(id: ReservationId, guestId: string | null, partySize: number, currency: string, waivedShare = 0): Reservation {
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > LARGEST_PARTY) throw new Error(`party size must be a whole number from 1 to ${String(LARGEST_PARTY)}`);
    const reservation = new Reservation(id, guestId, partySize, currency, false, waivedShare);
    reservation.pending.push(new TableBooked(id.value, guestId, partySize, reservation.deposit().cents, currency));
    return reservation;
  }

  static restore(state: ReservationState): Reservation {
    return new Reservation(state.id, state.guestId, state.partySize, state.currency, state.completed, state.waivedShare);
  }

  get completed(): boolean {
    return this.done;
  }

  waived(): Money {
    return Money.of(DEPOSIT_PER_SEAT, this.currency).times(this.partySize).times(this.waivedShare);
  }

  deposit(): Money {
    return Money.of(DEPOSIT_PER_SEAT, this.currency).times(this.partySize).minus(this.waived());
  }

  complete(): void {
    if (this.done) throw new Error(`reservation ${this.id.value} is already completed`);
    this.done = true;
    this.pending.push(new ReservationCompleted(this.id.value, this.guestId));
  }

  state(): ReservationState {
    return { id: this.id, guestId: this.guestId, partySize: this.partySize, currency: this.currency, completed: this.done, waivedShare: this.waivedShare };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
