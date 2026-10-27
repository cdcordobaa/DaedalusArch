import type { MemberRepository } from '../../membership/domain/member/MemberRepository';
import { MemberId } from '../../membership/domain/member/value-objects/MemberId';
import { Money } from '../../shared-kernel/Money';
import { Booking } from '../domain/booking/Booking';
import type { BookingRepository } from '../domain/booking/BookingRepository';
import type { MemberDirectory } from './ports/MemberDirectory';

export interface BookingRequest {
  readonly classCode: string;
  readonly sessions: number;
  readonly fee: number;
}

export interface MadeBooking {
  readonly bookingId: string;
  readonly total: number;
  readonly discount: number;
}

export class BookClass {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly directory: MemberDirectory,
    private readonly members: MemberRepository,
  ) {}

  execute(memberId: string | null, classes: readonly BookingRequest[], currency = 'EUR'): MadeBooking {
    if (memberId !== null && !this.directory.exists(memberId)) throw new Error(`no member ${memberId}`);
    const member = memberId === null ? undefined : this.members.byId(MemberId.of(memberId));
    const rate = member?.level() === 'premium' ? 0.2 : member?.level() === 'plus' ? 0.1 : 0;
    const booking = Booking.make(this.bookings.nextId(), memberId, classes.map((c) => ({ classCode: c.classCode, sessions: c.sessions, fee: Money.of(c.fee, currency) })), rate);
    this.bookings.save(booking);
    if (member !== undefined) {
      member.addVisits(classes.reduce((n, c) => n + c.sessions, 0));
      this.members.save(member);
    }
    return { bookingId: booking.id.value, total: booking.total().amount(), discount: booking.discount().amount() };
  }
}
