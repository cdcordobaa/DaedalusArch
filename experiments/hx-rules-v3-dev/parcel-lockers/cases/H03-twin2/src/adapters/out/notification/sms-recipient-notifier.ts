import { RecipientNotifierPort } from '../../../application/ports/out/recipient-notifier.port';
import { Parcel } from '../../../domain/parcel';
import { parcelLabel } from '../common/parcel-label';

export class SmsRecipientNotifier implements RecipientNotifierPort {
  async notifyCollected(phone: string, parcelId: string): Promise<void> {
    console.log(`[sms to ${phone.slice(-4)}] parcel ${parcelLabel(new Parcel(parcelId, 'n/a', phone, ''))} collected`);
  }
}
