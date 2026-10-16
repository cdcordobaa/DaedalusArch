import { lateFeeFor, type Booking } from '../domain/booking';
import type { BookingRepository } from '../domain/booking-repository';
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
    const fee = lateFeeFor(booking, now);
    if (fee > 0) {
      const charged = await this.payments.charge(booking.customerEmail, fee, `late return ${booking.id}`);
      booking.lateFee = { amountCents: charged.amountCents, paymentId: charged.paymentId };
    }
    await this.bookings.save(booking);
    return booking;
  }
}
