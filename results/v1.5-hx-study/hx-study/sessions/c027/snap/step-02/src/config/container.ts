import { PaystreamClient } from 'paystream-sdk';
import { PaymentsController } from '../adapters/inbound/http/PaymentsController';
import { PaystreamChargesAdapter } from '../adapters/outbound/paystream/PaystreamChargesAdapter';
import { PaystreamRefundsAdapter } from '../adapters/outbound/paystream/PaystreamRefundsAdapter';
import { CheckoutService } from '../application/services/CheckoutService';
import { RefundPaymentService } from '../application/services/RefundPaymentService';

/** Composition root. The Paystream key comes from PAYSTREAM_API_KEY. */
export function createApp() {
  const paystream = new PaystreamClient({ apiKey: process.env.PAYSTREAM_API_KEY ?? '' });
  const checkouts = new CheckoutService(new PaystreamChargesAdapter(paystream));
  const refunds = new RefundPaymentService(new PaystreamRefundsAdapter(paystream));
  const http = new PaymentsController(checkouts, refunds);
  return {
    checkout: (orderId: string, total: number, currency: string, cardToken: string) => checkouts.checkout({ orderId, total, currency, cardToken }),
    refund: (paymentReference: string, amount: number, currency: string) => refunds.refund({ paymentReference, amount, currency }),
    http,
  };
}
