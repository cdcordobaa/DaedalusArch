import { PaystreamUnavailableError } from 'paystream-sdk';
import { Order } from '../../domain/model/Order';
import { Invoicing } from '../../domain/services/Invoicing';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { PaymentsPort } from '../ports/out/PaymentsPort';

const DECLINE_MESSAGES: Record<string, string> = {
  insufficient_funds: 'Your card has insufficient funds.',
  expired_card: 'Your card has expired.',
};

export class CheckoutService implements Checkout {
  constructor(
    private readonly payments: PaymentsPort,
    private readonly invoicing: Invoicing = new Invoicing(),
  ) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    const amountMinor = order.total.cents + Math.round((order.total.cents * 1.5) / 100);
    try {
      const charge = await this.payments.charge({ amountMinor, currency: order.total.currency, source: { token: request.cardToken }, captureMethod: 'automatic', merchantReference: order.id });
      if (charge.state === 'DECLINED') {
        return { orderId: order.id, status: 'declined', amount: amountMinor / 100, currency: charge.currency, message: DECLINE_MESSAGES[charge.declineCode ?? ''] ?? 'Your card was declined.' };
      }
      return { orderId: order.id, status: 'paid', amount: charge.amountMinor / 100, currency: charge.currency, reference: charge.chargeId };
    } catch (e) {
      if (!(e instanceof PaystreamUnavailableError)) throw e;
      const payment = this.invoicing.invoiceFor(order);
      return { orderId: order.id, status: payment.status, amount: payment.amount.amount(), currency: payment.amount.currency, reference: payment.reference };
    }
  }
}
