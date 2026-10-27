import type { PaystreamCharge, PaystreamChargeRequest, PaystreamClient } from 'paystream-sdk';
import type { PaymentsPort } from '../../../application/ports/out/PaymentsPort';

export class PaystreamPaymentsAdapter implements PaymentsPort {
  constructor(private readonly client: PaystreamClient) {}

  charge(request: PaystreamChargeRequest): Promise<PaystreamCharge> {
    return this.client.charge(request);
  }
}
