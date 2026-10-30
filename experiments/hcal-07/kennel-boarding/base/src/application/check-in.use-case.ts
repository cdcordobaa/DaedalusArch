import { BookingNotFoundError } from '../domain/errors';
import { CheckInCommand, CheckInPort } from './ports/in/check-in.port';
import { BookingRepositoryPort } from './ports/out/booking-repository.port';
import { OwnerNotifierPort } from './ports/out/owner-notifier.port';

export class CheckInUseCase implements CheckInPort {
  constructor(
    private readonly bookings: BookingRepositoryPort,
    private readonly notifier: OwnerNotifierPort,
  ) {}

  async checkIn(command: CheckInCommand): Promise<void> {
    const booking = await this.bookings.findById(command.bookingId);
    if (booking === null) throw new BookingNotFoundError(command.bookingId);
    booking.checkIn();
    await this.bookings.save(booking);
    await this.notifier.notify(booking.ownerId, booking.id, booking.currentStatus);
  }
}
