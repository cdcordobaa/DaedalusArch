import { PaymentError } from '../../domain/errors/PaymentError';
import { Money } from '../../domain/model/Money';
import { Order } from '../../domain/model/Order';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import { Invoicing } from '../../domain/services/Invoicing';
import type { Charges } from '../ports/out/Charges';

/** Card surcharge: 1.5% of the total, rounded to the nearest cent. */
function withSurcharge(total: Money): Money {
  const surcharge = Math.round((total.cents * 15) / 1000);
  return Money.ofCents(total.cents + surcharge, total.currency);
}

export class CheckoutService implements Checkout {
  constructor(private readonly charges: Charges) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    if (request.cardToken.trim() === '') throw new PaymentError('a card token is required');
    const result = await this.charges.charge(request.cardToken, withSurcharge(order.total), order.id);
    if (!result.approved && 'unavailable' in result) {
      const invoice = new Invoicing().invoiceFor(order);
      return { orderId: order.id, status: invoice.status, amount: invoice.amount.amount(), currency: invoice.amount.currency, reference: invoice.reference };
    }
    if (!result.approved) {
      const message =
        result.reason === 'insufficient_funds' ? 'Your card has insufficient funds.'
        : result.reason === 'expired_card' ? 'Your card has expired.'
        : 'Your card was declined.';
      return { orderId: order.id, status: 'declined', amount: order.total.amount(), currency: order.total.currency, message };
    }
    return { orderId: order.id, status: 'paid', amount: result.amount.amount(), currency: result.amount.currency, reference: result.reference };
  }
}
