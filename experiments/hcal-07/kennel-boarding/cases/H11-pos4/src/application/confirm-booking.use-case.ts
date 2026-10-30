import { BookingNotFoundError, DepositRefusedError } from '../domain/errors';
import { depositCents } from '../domain/pricing';
import { depositAuditRow } from './deposit-audit';
import { ConfirmBookingCommand, ConfirmBookingPort, ConfirmBookingResult } from './ports/in/confirm-booking.port';
import { BookingRepositoryPort } from './ports/out/booking-repository.port';
import { DepositPaymentPort } from './ports/out/deposit-payment.port';
import { OwnerNotifierPort } from './ports/out/owner-notifier.port';

export class ConfirmBookingUseCase implements ConfirmBookingPort {
  constructor(
    private readonly bookings: BookingRepositoryPort,
    private readonly payments: DepositPaymentPort,
    private readonly notifier: OwnerNotifierPort,
  ) {}

  async confirm(command: ConfirmBookingCommand): Promise<ConfirmBookingResult> {
    const booking = await this.bookings.findById(command.bookingId);
    if (booking === null) throw new BookingNotFoundError(command.bookingId);
    const hold = await this.payments.hold({
      bookingId: booking.id,
      ownerId: booking.ownerId,
      amountCents: depositCents(booking.runSize, booking.nights),
    });
    if (hold.outcome === 'refused') throw new DepositRefusedError(hold.refusalReason ?? 'card-refused');
    booking.confirm(hold);
    await this.bookings.save(booking);
    await this.notifier.notify(booking.ownerId, booking.id, booking.currentStatus);
    return { bookingId: booking.id, status: booking.currentStatus, auditRow: depositAuditRow(booking.id, hold, new Date()) };
  }
}
