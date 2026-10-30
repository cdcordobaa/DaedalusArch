import { Order } from '../../domain/model/Order';
import { CardDeclinedError } from '../../domain/errors/CardDeclinedError';
import type { CardDeclineReason } from '../../domain/errors/CardDeclinedError';
import { PaymentUnavailableError } from '../../domain/errors/PaymentUnavailableError';
import { Invoicing } from '../../domain/services/Invoicing';
import type { Payment } from '../../domain/model/Payment';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { CardPayments } from '../ports/out/CardPayments';

/** Card surcharge in tenths of a percent: 15 is 1.5%. */
const CARD_SURCHARGE_PER_MILLE = 15;

const DECLINE_MESSAGES: Record<CardDeclineReason, string> = {
  'insufficient-funds': 'Your card has insufficient funds.',
  expired:'Your card has expired.',
  other: 'Your card was declined.',
};

export class CheckoutService implements Checkout {
  constructor(private readonly cardPayments: CardPayments) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    const amount = order.total.withSurchargePerMille(CARD_SURCHARGE_PER_MILLE);
    let payment: Payment;
    try {
      const charge = await this.cardPayments.charge(order.id, amount, request.cardToken);
      payment = { status: 'paid', amount, reference: charge.reference };
    } catch (e) {
      if (e instanceof CardDeclinedError) {
        return { orderId: order.id, status: 'declined', amount: amount.amount(), currency: amount.currency, reference: '', message: DECLINE_MESSAGES[e.reason] };
      }
      if (!(e instanceof PaymentUnavailableError)) throw e;
      payment = new Invoicing().invoiceFor(order);
    }
    return { orderId: order.id, status: payment.status, amount: payment.amount.amount(), currency: payment.amount.currency, reference: payment.reference };
  }
}
