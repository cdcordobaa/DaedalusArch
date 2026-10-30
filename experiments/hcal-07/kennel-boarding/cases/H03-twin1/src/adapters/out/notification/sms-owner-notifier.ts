import { OwnerNotifierPort } from '../../../application/ports/out/owner-notifier.port';
import { BookingStatus } from '../../../domain/booking-status';
import { ownerRef } from '../shared/owner-ref';

export class SmsOwnerNotifier implements OwnerNotifierPort {
  async notify(ownerId: string, bookingId: string, status: BookingStatus): Promise<void> {
    console.log(`[sms to ${ownerRef(ownerId)}] booking ${bookingId}: ${status}`);
  }
}
