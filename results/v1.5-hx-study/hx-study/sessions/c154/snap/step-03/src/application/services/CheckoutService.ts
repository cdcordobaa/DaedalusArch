import { CardDeclinedError } from '../../domain/errors/CardDeclinedError';
import { PaymentError } from '../../domain/errors/PaymentError';
import { PaymentUnavailableError } from '../../domain/errors/PaymentUnavailableError';
import { Order } from '../../domain/model/Order';
import { Invoicing } from '../../domain/services/Invoicing';
import { totalWithCardSurcharge } from '../../domain/services/CardSurcharge';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { CardPayments } from '../ports/out/CardPayments';

export class CheckoutService implements Checkout {
  constructor(private readonly cardPayments: CardPayments) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    if (request.cardToken.trim() === '') throw new PaymentError('a card token is required');
    let charge;
    try {
      charge = await this.cardPayments.charge(request.cardToken, totalWithCardSurcharge(order.total), order.id);
    } catch (e) {
      if (e instanceof CardDeclinedError) {
        return { orderId: order.id, status: 'declined', amount: order.total.amount(), currency: order.total.currency, reference: '', message: e.customerMessage() };
      }
      if (!(e instanceof PaymentUnavailableError)) throw e;
      const invoice = new Invoicing().invoiceFor(order);
      return { orderId: order.id, status: invoice.status, amount: invoice.amount.amount(), currency: invoice.amount.currency, reference: invoice.reference };
    }
    return { orderId: order.id, status: 'paid', amount: charge.amount.amount(), currency: charge.amount.currency, reference: charge.reference };
  }
}
