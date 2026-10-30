import { FurPayApiError, FurPayClient } from 'furpay-sdk';
import { DepositPaymentPort, DepositRequest } from '../../../application/ports/out/deposit-payment.port';
import { DepositHold } from '../../../domain/deposit';
import { PaymentProviderUnavailableError } from '../../../domain/errors';
import { REASON_BY_DECLINE } from '../../../domain/deposit';

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
        refusalReason: res.decline_code === null ? null : REASON_BY_DECLINE[res.decline_code] ?? 'card-refused',
        amountHeldCents: res.amount_authorised,
      };
    } catch (e) {
      if (e instanceof FurPayApiError) throw new PaymentProviderUnavailableError(`payment provider unavailable: ${e.message}`);
      throw e;
    }
  }
}
