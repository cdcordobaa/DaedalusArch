import { PaymentDeclinedError, PaymentUnavailableError } from '../../domain/errors/PaymentError';
import { Order } from '../../domain/model/Order';
import { Invoicing } from '../../domain/services/Invoicing';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { Charges } from '../ports/out/Charges';

/** Card surcharge in basis points (1.5%). */
const CARD_SURCHARGE_BASIS_POINTS = 150;

const DECLINE_MESSAGES = {
  insufficient_funds: 'Your card has insufficient funds.',
  expired_card: 'Your card has expired.',
  other: 'Your card was declined.',
} as const;

export class CheckoutService implements Checkout {
  constructor(private readonly charges: Charges) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    const amount = order.total.plusSurcharge(CARD_SURCHARGE_BASIS_POINTS);
    let receipt;
    try {
      receipt = await this.charges.charge(request.cardToken, amount, order.id);
    } catch (e) {
      if (e instanceof PaymentDeclinedError) {
        return { orderId: order.id, status: 'declined', amount: amount.amount(), currency: amount.currency, reference: '', message: DECLINE_MESSAGES[e.reason] };
      }
      if (!(e instanceof PaymentUnavailableError)) throw e;
      const invoice = new Invoicing().invoiceFor(order);
      return { orderId: order.id, status: invoice.status, amount: invoice.amount.amount(), currency: invoice.amount.currency, reference: invoice.reference };
    }
    return { orderId: order.id, status: 'paid', amount: amount.amount(), currency: amount.currency, reference: receipt.reference };
  }
}
