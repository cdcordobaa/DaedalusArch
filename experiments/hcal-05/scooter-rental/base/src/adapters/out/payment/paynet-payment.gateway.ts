import { PaynetClient, PaynetError, PaynetStatus } from 'paynet-sdk';
import { PaymentGatewayPort } from '../../../application/ports/out/payment-gateway.port';
import { ChargeOutcome } from '../../../domain/charge-outcome';
import { Money } from '../../../domain/money';

const STATUS_TO_OUTCOME: Record<PaynetStatus, ChargeOutcome> = {
  AUTHORIZED: 'paid',
  DECLINED_INSUFFICIENT_FUNDS: 'insufficient-funds',
  DECLINED_CARD_EXPIRED: 'card-expired',
  DECLINED_SUSPECTED_FRAUD: 'fraud-suspected',
  PENDING_REVIEW: 'under-review',
};

export class PaynetPaymentGateway implements PaymentGatewayPort {
  constructor(private readonly client: PaynetClient, private readonly merchantRef: string) {}
  async charge(amount: Money, cardToken: string, reference: string): Promise<ChargeOutcome> {
    try {
      const res = await this.client.charge({
        amount_minor: amount.cents,
        currency_code: amount.currency,
        card_token: cardToken,
        merchant_ref: `${this.merchantRef}:${reference}`,
        precision: 'MINOR_UNITS',
      });
      return STATUS_TO_OUTCOME[res.status];
    } catch (e) {
      if (e instanceof PaynetError) return 'unavailable';
      throw e;
    }
  }
}
