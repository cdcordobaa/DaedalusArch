import { RecipientNotifierPort } from '../../../application/ports/out/recipient-notifier.port';

export class SmsRecipientNotifier implements RecipientNotifierPort {
  async notifyCollected(phone: string, parcelId: string): Promise<void> {
    console.log(`[sms to ${phone.slice(-4)}] parcel ${parcelId} collected`);
  }
}
