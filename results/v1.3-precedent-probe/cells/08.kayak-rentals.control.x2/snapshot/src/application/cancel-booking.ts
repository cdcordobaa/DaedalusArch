import { canCancel, type Booking } from '../domain/booking';
import type { BookingRepository } from '../domain/booking-repository';
import type { PaymentGateway, PaymentResult } from './ports/payment-gateway';

export class CancelBooking {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly payments: PaymentGateway,
  ) {}

  async execute(bookingId: string, now = new Date()): Promise<{ booking: Booking; refund?: PaymentResult }> {
    const booking = await this.bookings.findById(bookingId);
    if (booking === undefined) throw new Error(`unknown booking ${bookingId}`);
    if (!canCancel(booking, now)) throw new Error('bookings can only be cancelled up to 24 hours before they start');
    booking.status = 'cancelled';
    const refund =
      booking.depositPaymentId === undefined ? undefined : await this.payments.refund(booking.depositPaymentId, `refund ${booking.id}`);
    await this.bookings.save(booking);
    return refund === undefined ? { booking } : { booking, refund };
  }
}
