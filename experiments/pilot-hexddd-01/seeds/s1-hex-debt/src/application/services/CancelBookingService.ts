import { BookingError } from '../../domain/errors/BookingError';
import { CancelBooking } from '../ports/in/CancelBooking';
import { BookingView, toBookingView } from '../ports/in/BookingView';
import { BookingRepository } from '../ports/out/BookingRepository';
import { GuestRepository } from '../ports/out/GuestRepository';
import { NotificationSender } from '../ports/out/NotificationSender';
import { PaymentGateway } from '../ports/out/PaymentGateway';

export class CancelBookingService implements CancelBooking {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly guests: GuestRepository,
    private readonly payments: PaymentGateway,
    private readonly notifications: NotificationSender,
  ) {}

  async cancel(bookingId: string): Promise<BookingView> {
    const booking = await this.bookings.findById(bookingId);
    if (booking === undefined) throw new BookingError('not-found', `No booking ${bookingId}`);
    booking.cancel();
    await this.payments.refund(booking.paymentRef);
    await this.bookings.save(booking);
    const guest = await this.guests.findById(booking.guestId);
    if (guest !== undefined) await this.notifications.send(guest.email, `Booking ${booking.id} is cancelled`);
    return toBookingView(booking);
  }
}
