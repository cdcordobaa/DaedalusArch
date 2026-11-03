import { ClientNotifierPort } from '../../../application/ports/out/client-notifier.port';
import { BookingStatus } from '../../../domain/booking-status';

export class ConsoleClientNotifier implements ClientNotifierPort {
  async notify(clientId: string, bookingId: string, status: BookingStatus): Promise<void> {
    console.log(`client ${clientId}: booking ${bookingId} is ${status}`);
  }
}
