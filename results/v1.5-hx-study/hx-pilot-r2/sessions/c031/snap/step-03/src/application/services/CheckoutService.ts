import { CardDeclinedError } from '../../domain/errors/CardDeclinedError';
import { PaymentError } from '../../domain/errors/PaymentError';
import { PaymentProviderUnavailableError } from '../../domain/errors/PaymentProviderUnavailableError';
import { Order } from '../../domain/model/Order';
import { CardSurcharge } from '../../domain/services/CardSurcharge';
import { Invoicing } from '../../domain/services/Invoicing';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { CardPayments } from '../ports/out/CardPayments';

export class CheckoutService implements Checkout {
  constructor(
    private readonly cardPayments: CardPayments,
    private readonly surcharge: CardSurcharge = new CardSurcharge(),
    private readonly invoicing: Invoicing = new Invoicing(),
  ) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    if (request.cardToken.trim() === '') throw new PaymentError('a card token is required');
    const toCharge = this.surcharge.totalToCharge(order.total);
    let charge;
    try {
      charge = await this.cardPayments.charge(request.cardToken, toCharge, order.id);
    } catch (e) {
      if (e instanceof CardDeclinedError) {
        const message =
          e.reason === 'not-enough-money' ? 'Your card has insufficient funds.'
          : e.reason === 'card-out-of-date' ? 'Your card has expired.'
          : 'Your card was declined.';
        return { orderId: order.id, status: 'declined', amount: 0, currency: order.total.currency, reference: '', message };
      }
      if (!(e instanceof PaymentProviderUnavailableError)) throw e;
      const invoice = this.invoicing.invoiceFor(order);
      return { orderId: order.id, status: invoice.status, amount: invoice.amount.amount(), currency: invoice.amount.currency, reference: invoice.reference };
    }
    return { orderId: order.id, status: 'paid', amount: charge.amount.amount(), currency: charge.amount.currency, reference: charge.reference };
  }
}
