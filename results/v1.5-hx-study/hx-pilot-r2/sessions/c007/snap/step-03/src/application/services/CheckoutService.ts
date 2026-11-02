import { CardDeclinedError, PaymentError, PaymentUnavailableError } from '../../domain/errors/PaymentError';
import { Invoicing } from '../../domain/services/Invoicing';
import { Money } from '../../domain/model/Money';
import { Order } from '../../domain/model/Order';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { CardPayments } from '../ports/out/CardPayments';

/** Card surcharge: 1.5% of the total, expressed in thousandths. */
const SURCHARGE_PER_MILLE = 15;

export class CheckoutService implements Checkout {
  constructor(private readonly cardPayments: CardPayments) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    if (request.cardToken.trim() === '') throw new PaymentError('a card token is required');
    const surcharge = Money.ofCents(Math.round((order.total.cents * SURCHARGE_PER_MILLE) / 1000), order.total.currency);
    let charged;
    try {
      charged = await this.cardPayments.charge(order.id, request.cardToken, order.total.plus(surcharge));
    } catch (e) {
      if (e instanceof CardDeclinedError) {
        const message = e.reason === 'insufficient_funds' ? 'Your card has insufficient funds.' : e.reason === 'expired_card' ? 'Your card has expired.' : 'Your card was declined.';
        return { orderId: order.id, status: 'declined', amount: order.total.amount(), currency: order.total.currency, message };
      }
      if (!(e instanceof PaymentUnavailableError)) throw e;
      const invoice = new Invoicing().invoiceFor(order);
      return { orderId: order.id, status: invoice.status, amount: invoice.amount.amount(), currency: invoice.amount.currency, reference: invoice.reference };
    }
    return { orderId: order.id, status: 'paid', amount: charged.amount.amount(), currency: charged.amount.currency, reference: charged.reference };
  }
}
