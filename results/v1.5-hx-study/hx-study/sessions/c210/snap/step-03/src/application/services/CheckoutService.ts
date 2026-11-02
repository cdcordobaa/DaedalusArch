import { CardDeclinedError, type CardDeclineReason } from '../../domain/errors/CardDeclinedError';
import { PaymentUnavailableError } from '../../domain/errors/PaymentUnavailableError';
import { Order } from '../../domain/model/Order';
import { Invoicing } from '../../domain/services/Invoicing';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { CardChargeResult, CardPayments } from '../ports/out/CardPayments';

/** Card surcharge in tenths of a percent: 15 = 1.5%. */
const CARD_SURCHARGE_TENTHS_PERCENT = 15;

const DECLINE_MESSAGES: Record<CardDeclineReason, string> = {
  insufficientFunds: 'Your card has insufficient funds.',
  cardExpired: 'Your card has expired.',
  other: 'Your card was declined.',
};

export class CheckoutService implements Checkout {
  constructor(private readonly cardPayments: CardPayments) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    const amount = order.total.plusSurcharge(CARD_SURCHARGE_TENTHS_PERCENT);
    let charge: CardChargeResult;
    try {
      charge = await this.cardPayments.charge(request.cardToken, amount, order.id);
    } catch (e) {
      if (e instanceof CardDeclinedError) {
        return {
          orderId: order.id,
          status: 'declined',
          amount: amount.amount(),
          currency: amount.currency,
          reference: '',
          message: DECLINE_MESSAGES[e.reason],
        };
      }
      if (!(e instanceof PaymentUnavailableError)) throw e;
      // Provider down: place the order on invoice, without the card surcharge.
      const invoice = new Invoicing().invoiceFor(order);
      return {
        orderId: order.id,
        status: invoice.status,
        amount: invoice.amount.amount(),
        currency: invoice.amount.currency,
        reference: invoice.reference,
      };
    }
    return { orderId: order.id, status: 'paid', amount: amount.amount(), currency: amount.currency, reference: charge.reference };
  }
}
