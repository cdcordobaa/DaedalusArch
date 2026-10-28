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

const DISCOUNT_BY_LEVEL: Readonly<Record<string, number>> = { premium: 0.2, plus: 0.1 };

export class BookClass {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly directory: MemberDirectory,
  ) {}

  execute(memberId: string | null, classes: readonly BookingRequest[], currency = 'EUR'): MadeBooking {
    if (memberId !== null && !this.directory.exists(memberId)) throw new Error(`no member ${memberId}`);
    const rate = memberId === null ? 0 : (DISCOUNT_BY_LEVEL[this.directory.levelOf(memberId) ?? ''] ?? 0);
    const booking = Booking.make(this.bookings.nextId(), memberId, classes.map((c) => ({ classCode: c.classCode, sessions: c.sessions, fee: Money.of(c.fee, currency) })), rate);
    // The booking is fully validated by now; the visits are recorded in the same step as the booking is stored,
    // and the visit write (the one that can still fail) goes first so a failure leaves neither behind.
    if (memberId !== null) this.directory.addVisits(memberId, booking.classes.reduce((sum, c) => sum + c.sessions, 0));
    this.bookings.save(booking);
    return { bookingId: booking.id.value, total: booking.total().amount(), discount: booking.discount().amount() };
  }
}
