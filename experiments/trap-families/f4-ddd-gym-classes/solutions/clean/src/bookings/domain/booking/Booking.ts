import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { Money } from '../../../shared-kernel/Money';
import { BookingMade } from './events/BookingMade';
import type { BookingId } from './value-objects/BookingId';
import { discountRateOf, type CustomerLevel } from './value-objects/CustomerLevel';

export interface BookedClass {
  readonly classCode: string;
  readonly sessions: number;
  readonly fee: Money;
}

export interface BookingState {
  readonly id: BookingId;
  readonly memberId: string | null;
  readonly classes: readonly BookedClass[];
  readonly level: CustomerLevel;
}

/** A class booking. Every class has a positive whole number of sessions and a non-negative fee per session. */
export class Booking {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: BookingId,
    readonly memberId: string | null,
    readonly classes: readonly BookedClass[],
    readonly level: CustomerLevel,
  ) {}

  static make(id: BookingId, memberId: string | null, classes: readonly BookedClass[], level: CustomerLevel = 'basic'): Booking {
    if (classes.length === 0) throw new Error('a booking needs at least one class');
    for (const c of classes) {
      if (!Number.isInteger(c.sessions) || c.sessions <= 0) throw new Error(`class ${c.classCode}: sessions must be a positive whole number`);
      if (c.fee.isNegative()) throw new Error(`class ${c.classCode}: fee must not be negative`);
    }
    const booking = new Booking(id, memberId, classes, level);
    booking.pending.push(new BookingMade(id.value, memberId, booking.total().cents, booking.total().currency, booking.sessions()));
    return booking;
  }

  static restore(state: BookingState): Booking {
    return new Booking(state.id, state.memberId, state.classes, state.level);
  }

  sessions(): number {
    return this.classes.reduce((n, c) => n + c.sessions, 0);
  }

  subtotal(): Money {
    const currency = this.classes[0]?.fee.currency ?? 'EUR';
    return this.classes.reduce((sum, c) => sum.plus(c.fee.times(c.sessions)), Money.zero(currency));
  }

  discount(): Money {
    return this.subtotal().times(discountRateOf(this.level));
  }

  total(): Money {
    return this.subtotal().minus(this.discount());
  }

  state(): BookingState {
    return { id: this.id, memberId: this.memberId, classes: this.classes, level: this.level };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
