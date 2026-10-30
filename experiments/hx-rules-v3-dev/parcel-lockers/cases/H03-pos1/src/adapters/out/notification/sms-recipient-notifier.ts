import { RecipientNotifierPort } from '../../../application/ports/out/recipient-notifier.port';
import { InMemoryParcelRepository } from '../persistence/in-memory-parcel.repository';

export class SmsRecipientNotifier implements RecipientNotifierPort {
  constructor(private readonly parcels: InMemoryParcelRepository) {}

  async notifyCollected(phone: string, parcelId: string): Promise<void> {
    const parcel = await this.parcels.findById(parcelId);
    console.log(`[sms to ${phone.slice(-4)}] parcel ${parcelId} collected (${parcel?.lockerId ?? 'unknown locker'})`);
  }
}
