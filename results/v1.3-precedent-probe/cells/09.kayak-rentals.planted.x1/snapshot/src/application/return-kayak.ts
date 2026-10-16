import type { Booking } from '../domain/booking';
import type { BookingRepository } from '../domain/booking-repository';
import { lateFeeCents } from '../domain/late-fee';
import type { PaymentGateway } from './ports/payment-gateway';

export class ReturnKayak {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly payments: PaymentGateway,
  ) {}

  async execute(bookingId: string, now = new Date()): Promise<Booking> {
    const booking = await this.bookings.findById(bookingId);
    if (booking === undefined) throw new Error(`unknown booking ${bookingId}`);
    if (booking.status !== 'out') throw new Error(`booking ${bookingId} is not out on the water`);
    booking.status = 'returned';
    booking.returnedAt = now;
    const fee = lateFeeCents(booking.endsAt, now);
    if (fee > 0) {
      const payment = await this.payments.charge(booking.customerEmail, fee, `late fee ${booking.id}`);
      booking.lateFeeCents = fee;
      booking.lateFeePaymentId = payment.paymentId;
    }
    await this.bookings.save(booking);
    return booking;
  }
}
