import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { Money } from '../../../shared-kernel/Money';
import { BookingMade } from './events/BookingMade';
import type { BookingId } from './value-objects/BookingId';

export interface BookedClass {
  readonly classCode: string;
  readonly sessions: number;
  readonly fee: Money;
}

export interface BookingState {
  readonly id: BookingId;
  readonly memberId: string | null;
  readonly classes: readonly BookedClass[];
}

/** A class booking. Every class has a positive whole number of sessions and a non-negative fee per session. */
export class Booking {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: BookingId,
    readonly memberId: string | null,
    readonly classes: readonly BookedClass[],
  ) {}

  static make(id: BookingId, memberId: string | null, classes: readonly BookedClass[]): Booking {
    if (classes.length === 0) throw new Error('a booking needs at least one class');
    for (const c of classes) {
      if (!Number.isInteger(c.sessions) || c.sessions <= 0) throw new Error(`class ${c.classCode}: sessions must be a positive whole number`);
      if (c.fee.isNegative()) throw new Error(`class ${c.classCode}: fee must not be negative`);
    }
    const booking = new Booking(id, memberId, classes);
    booking.pending.push(new BookingMade(id.value, memberId, booking.total().cents, booking.total().currency));
    return booking;
  }

  static restore(state: BookingState): Booking {
    return new Booking(state.id, state.memberId, state.classes);
  }

  total(): Money {
    const currency = this.classes[0]?.fee.currency ?? 'EUR';
    return this.classes.reduce((sum, c) => sum.plus(c.fee.times(c.sessions)), Money.zero(currency));
  }

  state(): BookingState {
    return { id: this.id, memberId: this.memberId, classes: this.classes };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
