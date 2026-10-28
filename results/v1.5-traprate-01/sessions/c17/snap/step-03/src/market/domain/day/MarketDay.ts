import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import type { MarketDate } from '../../../shared-kernel/MarketDate';
import { NoShowReported } from './events/NoShowReported';
import { PitchBooked } from './events/PitchBooked';
import { VendorCheckedIn } from './events/VendorCheckedIn';
import type { Pitch } from './value-objects/Pitch';

export type Attendance = 'expected' | 'checked-in' | 'no-show';

export interface PitchBooking {
  readonly ref: string;
  readonly pitch: string;
  readonly vendorId: string;
  readonly attendance: Attendance;
}

export interface MarketDaySnapshot {
  readonly date: MarketDate;
  readonly pitches: readonly Pitch[];
  readonly bookings: readonly PitchBooking[];
}

/**
 * One market day: its pitch layout and who booked which pitch. A pitch has at most one booking, a vendor at most one
 * pitch per day; attendance moves from expected to checked in or to no-show, once.
 */
export class MarketDay {
  private notices: DomainEvent[] = [];

  private constructor(
    readonly date: MarketDate,
    private readonly pitches: readonly Pitch[],
    private bookings: PitchBooking[],
  ) {}

  static open(date: MarketDate, pitches: readonly Pitch[]): MarketDay {
    if (pitches.length === 0) throw new Error('a market day needs at least one pitch');
    const codes = new Set<string>();
    for (const p of pitches) {
      if (codes.has(p.code)) throw new Error(`duplicate pitch ${p.code}`);
      codes.add(p.code);
    }
    return new MarketDay(date, pitches, []);
  }

  static fromSnapshot(s: MarketDaySnapshot): MarketDay {
    return new MarketDay(s.date, s.pitches, [...s.bookings]);
  }

  pitch(code: string): Pitch {
    const p = this.pitches.find((x) => x.code === code);
    if (p === undefined) throw new Error(`no pitch ${code} on ${this.date.iso}`);
    return p;
  }

  book(ref: string, pitchCode: string, vendorId: string): Pitch {
    const pitch = this.pitch(pitchCode);
    if (this.bookings.some((b) => b.pitch === pitch.code)) throw new Error(`pitch ${pitch.code} is taken on ${this.date.iso}`);
    if (this.bookings.some((b) => b.vendorId === vendorId)) throw new Error(`vendor ${vendorId} already has a pitch on ${this.date.iso}`);
    this.bookings = [...this.bookings, { ref, pitch: pitch.code, vendorId, attendance: 'expected' }];
    this.notices.push(new PitchBooked(ref, this.date.iso, pitch.code, vendorId));
    return pitch;
  }

  checkIn(vendorId: string): void {
    const booking = this.bookings.find((b) => b.vendorId === vendorId);
    if (booking === undefined) throw new Error(`no booking for vendor ${vendorId} on ${this.date.iso}`);
    if (booking.attendance === 'checked-in') throw new Error(`vendor ${vendorId} already checked in`);
    if (booking.attendance === 'no-show') throw new Error(`vendor ${vendorId} was already reported as a no-show`);
    this.mark(booking, 'checked-in');
    this.notices.push(new VendorCheckedIn(this.date.iso, booking.pitch, vendorId));
  }

  reportNoShow(pitchCode: string): void {
    const booking = this.bookings.find((b) => b.pitch === pitchCode);
    if (booking === undefined) throw new Error(`no booking on pitch ${pitchCode} on ${this.date.iso}`);
    if (booking.attendance === 'checked-in') throw new Error(`vendor ${booking.vendorId} already checked in`);
    if (booking.attendance === 'no-show') throw new Error(`pitch ${pitchCode} was already reported as a no-show`);
    this.mark(booking, 'no-show');
    this.notices.push(new NoShowReported(booking.ref, this.date.iso, booking.pitch, booking.vendorId));
  }

  plan(): readonly PitchBooking[] {
    return [...this.bookings];
  }

  takeNotices(): DomainEvent[] {
    const out = this.notices;
    this.notices = [];
    return out;
  }

  snapshot(): MarketDaySnapshot {
    return { date: this.date, pitches: this.pitches, bookings: [...this.bookings] };
  }

  private mark(booking: PitchBooking, attendance: Attendance): void {
    this.bookings = this.bookings.map((b) => (b.ref === booking.ref ? { ...b, attendance } : b));
  }
}
