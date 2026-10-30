import { OwnerNotifierPort } from '../../../application/ports/out/owner-notifier.port';
import { BookingStatus } from '../../../domain/booking-status';

export class SmsOwnerNotifier implements OwnerNotifierPort {
  async notify(ownerId: string, bookingId: string, status: BookingStatus): Promise<void> {
    await this.sendText(ownerId, `booking ${bookingId}: ${status}`);
  }

  async sendText(ownerId: string, text: string): Promise<void> {
    console.log(`[sms to ${ownerId}] ${text}`);
  }
}
