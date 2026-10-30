import { DeclineCode, FurPayApiError, FurPayClient } from 'furpay-sdk';
import { DepositPaymentPort, DepositRequest } from '../../../application/ports/out/deposit-payment.port';
import { DepositHold, RefusalReason } from '../../../domain/deposit';
import { PaymentProviderUnavailableError } from '../../../domain/errors';

export class FurPayDepositGateway implements DepositPaymentPort {
  private readonly client: FurPayClient;

  constructor(secretKey: string) {
    this.client = new FurPayClient({ secret_key: secretKey });
  }

  async hold(request: DepositRequest): Promise<DepositHold> {
    try {
      const res = await this.client.hold({
        customer_ref: request.ownerId,
        amount_minor: request.amountCents,
        currency_iso: 'EUR',
        statement_descriptor: `KENNEL ${request.bookingId}`,
      });
      return {
        depositRef: res.charge_id,
        outcome: res.decline_code === null ? 'held' : 'refused',
        refusalReason: res.decline_code === null ? null : this.toReason(res.decline_code),
        amountHeldCents: res.amount_authorised,
        record: {
          charge_id: res.charge_id,
          charge_status: res.charge_status,
          amount_authorised: res.amount_authorised,
          receipt_url: res.receipt_url,
        },
      };
    } catch (e) {
      if (e instanceof FurPayApiError) throw new PaymentProviderUnavailableError(`payment provider unavailable: ${e.message}`);
      throw e;
    }
  }

  private toReason(code: DeclineCode): RefusalReason {
    if (code === 'insufficient_funds') return 'no-funds';
    if (code === 'expired_card') return 'card-expired';
    return 'card-refused';
  }
}
