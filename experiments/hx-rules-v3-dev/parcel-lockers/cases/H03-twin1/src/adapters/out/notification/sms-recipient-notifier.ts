import { RecipientNotifierPort } from '../../../application/ports/out/recipient-notifier.port';
import { maskPhone } from '../shared/phone-mask';

export class SmsRecipientNotifier implements RecipientNotifierPort {
  async notifyCollected(phone: string, parcelId: string): Promise<void> {
    console.log(`[sms to ${maskPhone(phone)}] parcel ${parcelId} collected`);
  }
}
