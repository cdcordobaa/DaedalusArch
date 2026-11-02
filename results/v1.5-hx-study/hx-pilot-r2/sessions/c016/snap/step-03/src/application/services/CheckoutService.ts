import { PaymentError } from '../../domain/errors/PaymentError';
import { Order } from '../../domain/model/Order';
import { Invoicing } from '../../domain/services/Invoicing';
import { CardSurcharge } from '../../domain/services/CardSurcharge';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { CardPayments } from '../ports/out/CardPayments';

export class CheckoutService implements Checkout {
  constructor(private readonly cardPayments: CardPayments) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    if (request.cardToken.trim() === '') throw new PaymentError('a card token is required');
    const amount = CardSurcharge.chargeableFor(order.total);
    const result = await this.cardPayments.charge(order.id, amount, request.cardToken);
    if (!result.paid && 'unavailable' in result) {
      const invoice = new Invoicing().invoiceFor(order);
      return { orderId: order.id, status: invoice.status, amount: invoice.amount.amount(), currency: invoice.amount.currency, reference: invoice.reference };
    }
    if (!result.paid) {
      const message =
        result.reason === 'no_funds' ? 'Your card has insufficient funds.'
        : result.reason === 'expired' ? 'Your card has expired.'
        : 'Your card was declined.';
      return { orderId: order.id, status: 'declined', amount: amount.amount(), currency: amount.currency, reference: '', message };
    }
    return { orderId: order.id, status: 'paid', amount: amount.amount(), currency: amount.currency, reference: result.reference };
  }
}
