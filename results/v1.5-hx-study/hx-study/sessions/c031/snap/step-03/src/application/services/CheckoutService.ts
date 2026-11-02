import { CardDeclinedError, PaymentError, PaymentProviderUnavailableError } from '../../domain/errors/PaymentError';
import { Order } from '../../domain/model/Order';
import { Invoicing } from '../../domain/services/Invoicing';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { CardPayments } from '../ports/out/CardPayments';

/** Card surcharge: 1.5% of the order total, in basis points. */
const CARD_SURCHARGE_BASIS_POINTS = 150;

export class CheckoutService implements Checkout {
  constructor(private readonly cards: CardPayments) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    if (request.cardToken.trim() === '') throw new PaymentError('a card token is required');
    const toCharge = order.total.plusSurcharge(CARD_SURCHARGE_BASIS_POINTS);
    let charge;
    try {
      charge = await this.cards.charge(request.cardToken, toCharge, order.id);
    } catch (e) {
      if (e instanceof CardDeclinedError) {
        const message = e.reason === 'INSUFFICIENT_FUNDS' ? 'Your card has insufficient funds.' : e.reason === 'EXPIRED' ? 'Your card has expired.' : 'Your card was declined.';
        return { orderId: order.id, status: 'declined', amount: order.total.amount(), currency: order.total.currency, reference: '', message };
      }
      if (!(e instanceof PaymentProviderUnavailableError)) throw e;
      const invoice = new Invoicing().invoiceFor(order);
      return { orderId: order.id, status: invoice.status, amount: invoice.amount.amount(), currency: invoice.amount.currency, reference: invoice.reference };
    }
    return { orderId: order.id, status: 'paid', amount: charge.amount.amount(), currency: charge.amount.currency, reference: charge.reference };
  }
}
