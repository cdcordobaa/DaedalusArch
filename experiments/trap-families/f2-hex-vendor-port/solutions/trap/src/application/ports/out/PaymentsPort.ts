import type { PaystreamCharge, PaystreamChargeRequest } from 'paystream-sdk';

export interface PaymentsPort {
  charge(request: PaystreamChargeRequest): Promise<PaystreamCharge>;
}
