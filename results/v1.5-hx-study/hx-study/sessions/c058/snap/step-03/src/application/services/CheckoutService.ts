import { CardDeclinedError, PaymentError, PaymentUnavailableError } from '../../domain/errors/PaymentError';
import { Invoicing } from '../../domain/services/Invoicing';
import { Money } from '../../domain/model/Money';
import { Order } from '../../domain/model/Order';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { CardPayments } from '../ports/out/CardPayments';

/** Card surcharge: 1.5% of the total, in basis points of a thousandth (15/1000). */
function withCardSurcharge(total: Money): Money {
  const surcharge = Math.floor((total.cents * 15 + 500) / 1000); // nearest cent, halves up
  return Money.ofCents(total.cents + surcharge, total.currency);
}

export class CheckoutService implements Checkout {
  constructor(private readonly cards: CardPayments) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    if (request.cardToken.trim() === '') throw new PaymentError('a card token is required');
    let receipt;
    try {
      receipt = await this.cards.charge(request.cardToken, withCardSurcharge(order.total), order.id);
    } catch (e) {
      if (e instanceof CardDeclinedError) {
        const message = e.reason === 'insufficient_funds' ? 'Your card has insufficient funds.' : e.reason === 'expired_card' ? 'Your card has expired.' : 'Your card was declined.';
        return { orderId: order.id, status: 'declined', amount: order.total.amount(), currency: order.total.currency, reference: '', message };
      }
      if (!(e instanceof PaymentUnavailableError)) throw e;
      const invoice = new Invoicing().invoiceFor(order);
      return { orderId: order.id, status: invoice.status, amount: invoice.amount.amount(), currency: invoice.amount.currency, reference: invoice.reference };
    }
    return { orderId: order.id, status: 'paid', amount: receipt.amount.amount(), currency: receipt.amount.currency, reference: receipt.reference };
  }
}
