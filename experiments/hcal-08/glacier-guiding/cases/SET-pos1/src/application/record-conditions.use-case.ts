import { Hazard } from '../domain/hazard';
import { RecordConditionsCommand, RecordConditionsPort } from './ports/in/record-conditions.port';
import { BookingRepositoryPort } from './ports/out/booking-repository.port';
import { ClientNotifierPort } from './ports/out/client-notifier.port';

export class RecordConditionsUseCase implements RecordConditionsPort {
  constructor(
    private readonly bookings: BookingRepositoryPort,
    private readonly notifier: ClientNotifierPort,
  ) {}

  async record(command: RecordConditionsCommand): Promise<number> {
    const hazard = command.band as Hazard;
    const bookings = await this.bookings.findByRoute(command.routeCode);
    for (const booking of bookings) {
      booking.applyHazard(hazard);
      await this.bookings.save(booking);
      await this.notifier.notify(booking.clientId, booking.id, booking.currentStatus);
    }
    return bookings.length;
  }
}
