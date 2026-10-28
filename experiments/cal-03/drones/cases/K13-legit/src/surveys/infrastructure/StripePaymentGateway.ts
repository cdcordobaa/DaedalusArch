import type { Money } from '../../shared-kernel/Money';
import type { PaymentGateway } from '../application/ports/PaymentGateway';

export class StripePaymentGateway implements PaymentGateway {
  readonly charges: string[] = [];

  charge(clientEmail: string, amount: Money, surveyId: string): string {
    const receipt = `ch_${surveyId}_${amount.cents}`;
    this.charges.push(`${clientEmail}:${receipt}`);
    return receipt;
  }
}
