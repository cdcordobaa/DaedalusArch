import { Order } from '../../domain/model/Order';
import { PaymentDeclinedError, PaymentUnavailableError } from '../../domain/errors/PaymentError';
import { CardSurcharge } from '../../domain/services/CardSurcharge';
import { Invoicing } from '../../domain/services/Invoicing';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { Charges } from '../ports/out/Charges';

export class CheckoutService implements Checkout {
  constructor(
    private readonly charges: Charges,
    private readonly surcharge: CardSurcharge = new CardSurcharge(),
  ) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    const amount = this.surcharge.chargeFor(order.total);
    let charge: { readonly reference: string };
    try {
      charge = await this.charges.charge(request.cardToken, amount, order.id);
    } catch (e) {
      if (e instanceof PaymentDeclinedError) {
        const message =
          e.reason === 'InsufficientFunds' ? 'Your card has insufficient funds.'
          : e.reason === 'CardExpired' ? 'Your card has expired.'
          : 'Your card was declined.';
        return { orderId: order.id, status: 'declined', amount: amount.amount(), currency: amount.currency, reference: '', message };
      }
      if (!(e instanceof PaymentUnavailableError)) throw e;
      const invoice = new Invoicing().invoiceFor(order);
      return { orderId: order.id, status: invoice.status, amount: invoice.amount.amount(), currency: invoice.amount.currency, reference: invoice.reference };
    }
    return { orderId: order.id, status: 'paid', amount: amount.amount(), currency: amount.currency, reference: charge.reference };
  }
}
