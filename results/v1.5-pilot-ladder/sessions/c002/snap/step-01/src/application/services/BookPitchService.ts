import type { Booking } from '../../domain/model/Booking';
import { BookingError } from '../../domain/errors/BookingError';
import { StayPricing } from '../../domain/services/StayPricing';
import type { BookingRequest, BookingView, BookPitch } from '../ports/in/BookPitch';
import type { Bookings } from '../ports/out/Bookings';
import type { PaymentRecords } from '../ports/out/PaymentRecords';

export class BookPitchService implements BookPitch {
  constructor(
    private readonly bookings: Bookings,
    private readonly records: PaymentRecords,
    private readonly pricing: StayPricing = new StayPricing(),
  ) {}

  async book(r: BookingRequest): Promise<BookingView> {
    const total = this.pricing.total(r.nights);
    const record = await this.records.find(r.paymentId);
    if (!record.authorized) return { bookingId: r.bookingId, status: 'unpaid', reason: 'The payment has not gone through yet.' };
    const booking: Booking = { bookingId: r.bookingId, pitch: r.pitch, nights: r.nights, total, paymentId: r.paymentId, deposit: record.amount, state: 'confirmed' };
    await this.bookings.save(booking);
    return this.view(booking);
  }

  async checkIn(bookingId: string): Promise<BookingView> {
    const b = await this.get(bookingId);
    if (b.state !== 'confirmed') throw new BookingError('only a confirmed booking can check in');
    const next: Booking = { ...b, state: 'checked_in' };
    await this.bookings.save(next);
    return this.view(next);
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
