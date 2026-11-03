import { RouteCondition } from '../domain/route-condition';
import { RecordConditionsCommand, RecordConditionsPort } from './ports/in/record-conditions.port';
import { BookingRepositoryPort } from './ports/out/booking-repository.port';
import { ClientNotifierPort } from './ports/out/client-notifier.port';

const CONDITION_BY_BAND: Record<string, RouteCondition> = {
  CALM: 'open',
  BREEZY: 'open',
  WATCH: 'caution',
  SURGE: 'closed',
  CLOSURE: 'closed',
};

export class RecordConditionsUseCase implements RecordConditionsPort {
  constructor(
    private readonly bookings: BookingRepositoryPort,
    private readonly notifier: ClientNotifierPort,
  ) {}

  async record(command: RecordConditionsCommand): Promise<number> {
    const condition: RouteCondition = CONDITION_BY_BAND[command.band] ?? 'closed';
    const bookings = await this.bookings.findByRoute(command.routeCode);
    for (const booking of bookings) {
      booking.applyCondition(condition);
      await this.bookings.save(booking);
      await this.notifier.notify(booking.clientId, booking.id, booking.currentStatus);
    }
    return bookings.length;
  }
}
