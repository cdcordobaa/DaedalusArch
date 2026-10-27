import type { MemberId } from './value-objects/MemberId';

export type Level = 'premium' | 'plus' | 'basic';

/** Visits from which a member holds each level. */
const PREMIUM_FROM = 45;
const PLUS_FROM = 25;

export interface MemberState {
  readonly id: MemberId;
  readonly name: string;
  readonly visits: number;
  readonly creditedBookings?: readonly string[];
}

/** A gym member. Visits never go down; the level follows from the visits. */
export class Member {
  private constructor(
    readonly id: MemberId,
    readonly name: string,
    private visitCount: number,
    private creditedBookings: string[] = [],
  ) {}

  static join(id: MemberId, name: string): Member {
    if (name.trim() === '') throw new Error('a member needs a name');
    return new Member(id, name, 0);
  }

  static restore(state: MemberState): Member {
    return new Member(state.id, state.name, state.visits, [...(state.creditedBookings ?? [])]);
  }

  get visits(): number {
    return this.visitCount;
  }

  level(): Level {
    if (this.visitCount >= PREMIUM_FROM) return 'premium';
    if (this.visitCount >= PLUS_FROM) return 'plus';
    return 'basic';
  }

  addVisits(visits: number): void {
    if (!Number.isInteger(visits) || visits <= 0) throw new Error('added visits must be a positive whole number');
    this.visitCount += visits;
  }

  /** One visit per booked session; a booking is credited once, however often it is reported. */
  creditBooking(bookingId: string, sessions: number): void {
    if (this.creditedBookings.includes(bookingId)) return;
    this.creditedBookings.push(bookingId);
    this.visitCount += sessions;
  }

  state(): MemberState {
    return { id: this.id, name: this.name, visits: this.visitCount, creditedBookings: [...this.creditedBookings] };
  }
}
