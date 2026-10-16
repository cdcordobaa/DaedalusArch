import { cancellable, type Booking } from '../domain/booking';
import type { BookingRepository } from '../domain/booking-repository';
import type { PaymentGateway } from './ports/payment-gateway';

export class CancelBooking {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly payments: PaymentGateway,
  ) {}

  async execute(bookingId: string, now = new Date()): Promise<Booking> {
    const booking = await this.bookings.findById(bookingId);
    if (booking === undefined) throw new Error(`unknown booking ${bookingId}`);
    if (!cancellable(booking, now)) throw new Error('too late to cancel: bookings can be cancelled up to 24 hours before the start');
    if (booking.depositPaymentId !== undefined) {
      const refund = await this.payments.refund(booking.depositPaymentId);
      booking.refundPaymentId = refund.paymentId;
    }
    booking.status = 'cancelled';
    await this.bookings.save(booking);
    return booking;
  }
}
