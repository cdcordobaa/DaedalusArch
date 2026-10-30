import type { Booking } from '../../../domain/model/Booking';
import { BookingError } from '../../../domain/errors/BookingError';
import { StayPricing } from '../../../domain/services/StayPricing';
import type { BookingRequest, BookingView, BookPitch } from '../../ports/in/BookPitch';
import type { Bookings } from '../../ports/out/storage/Bookings';
import type { Pitches } from '../../ports/out/storage/Pitches';
import type { Captures } from '../../ports/out/payments/Captures';
import type { PaymentRecords } from '../../ports/out/payments/PaymentRecords';

export class BookPitchService implements BookPitch {
  constructor(
    private readonly bookings: Bookings,
    private readonly pitches: Pitches,
    private readonly records: PaymentRecords,
    private readonly captures: Captures,
    private readonly pricing: StayPricing = new StayPricing(),
  ) {}

  async book(r: BookingRequest): Promise<BookingView> {
    const total = this.pricing.total(r.nights);
    const pitch = await this.pitches.find(r.pitch);
    if (pitch === null) throw new BookingError('there is no pitch ' + r.pitch);
    if (pitch.state === 'closed_for_works') throw new BookingError('This pitch is closed for works.');
    const record = await this.records.find(r.paymentId);
    if (record.providerStatus !== 'requires_capture') {
      return { bookingId: r.bookingId, status: 'unpaid', reason: 'The payment has not gone through yet.' };
    }
    const booking: Booking = { bookingId: r.bookingId, pitch: r.pitch, nights: r.nights, total, paymentId: r.paymentId, deposit: record.amount, state: 'confirmed' };
    await this.bookings.save(booking);
    return this.view(booking);
  }

  async checkIn(bookingId: string): Promise<BookingView> {
    const b = await this.get(bookingId);
    if (b.state !== 'confirmed') throw new BookingError('only a confirmed booking can check in');
    const result = await this.captures.capture(b.paymentId);
    if (result.outcome === 'canceled') return { ...this.view(b), status: 'payment_problem', payment: 'canceled' };
    const next: Booking = { ...b, state: 'checked_in' };
    await this.bookings.save(next);
    return { ...this.view(next), paid: result.amountReceived, payment: 'succeeded' };
  }

  async cancel(bookingId: string): Promise<BookingView> {
    const b = await this.get(bookingId);
    if (b.state === 'checked_in') throw new BookingError('a guest who has checked in cannot cancel');
    const next: Booking = { ...b, state: 'cancelled' };
    await this.bookings.save(next);
    return this.view(next);
  }

  private async get(bookingId: string): Promise<Booking> {
    const b = await this.bookings.get(bookingId);
    if (b === null) throw new BookingError('there is no booking ' + bookingId);
    return b;
  }

  private view(b: Booking): BookingView {
    return { bookingId: b.bookingId, status: b.state, pitch: b.pitch, nights: b.nights, total: b.total };
  }
}
