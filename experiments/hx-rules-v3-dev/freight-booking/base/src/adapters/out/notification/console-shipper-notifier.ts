import { ShipperNotifierPort } from '../../../application/ports/out/shipper-notifier.port';
import { BookingStatus } from '../../../domain/booking';

export class ConsoleShipperNotifier implements ShipperNotifierPort {
  async notifyBooking(shipperId: string, bookingId: string, status: BookingStatus): Promise<void> {
    console.log(`[to shipper ${shipperId.slice(-4)}] booking ${bookingId}: ${status}`);
  }
}
