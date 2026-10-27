import type { TextDelivery } from '../model/TextDelivery';

export type ReminderShown = 'delivered' | 'failed' | 'sent' | 'not sent' | 'opted out';

/** How a reminder shows on the front desk list, and whether the front desk must phone the patient instead. */
export class FrontDesk {
  shown(delivery: TextDelivery | undefined, optedOut: boolean): ReminderShown {
    if (delivery === 'delivered') return 'delivered';
    if (delivery === 'failed') return 'failed';
    if (delivery === 'pending') return 'sent';
    return optedOut ? 'opted out' : 'not sent';
  }

  mustCall(shown: ReminderShown): boolean {
    return shown !== 'delivered' && shown !== 'sent';
  }
}
