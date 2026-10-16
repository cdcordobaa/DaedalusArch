import { PaymentResult, PaymentsPort } from '../../../application/ports/payments.port';

interface PspClient {
  charge(request: { customer: string; amount: number; currency: string; metadata: Record<string, string> }): Promise<{ id: string; status: string }>;
  refund(request: { charge: string; amount: number }): Promise<void>;
}

/** Payment service provider adapter: charges in EUR, quoting the purchase order in the charge metadata. */
export class CardPaymentsGateway implements PaymentsPort {
  constructor(private readonly psp: PspClient) {}

  async authorise(clientId: string, amountCents: number, purchaseOrder: string): Promise<PaymentResult> {
    const charge = await this.psp.charge({ customer: clientId, amount: amountCents, currency: 'eur', metadata: { purchaseOrder } });
    return { authorised: charge.status === 'succeeded', reference: charge.id };
  }

  refund(reference: string, amountCents: number): Promise<void> {
    return this.psp.refund({ charge: reference, amount: amountCents });
  }
}
