import { PaymentError, PaymentProviderUnavailableError } from '../../domain/errors/PaymentError';
import { Invoicing } from '../../domain/services/Invoicing';
import { Money } from '../../domain/model/Money';
import { Order } from '../../domain/model/Order';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { CardPayments } from '../ports/out/CardPayments';

/** Card surcharge: 1.5% of the total, in basis points of a thousandth (15/1000). */
function surcharge(total: Money): Money {
  // Integer arithmetic, rounded half up to the nearest cent.
  return Money.ofCents(Math.floor((total.cents * 15 + 500) / 1000), total.currency);
}

export class CheckoutService implements Checkout {
  constructor(private readonly cardPayments: CardPayments) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    if (request.cardToken.trim() === '') throw new PaymentError('a card token is required');
    const amount = order.total.plus(surcharge(order.total));
    let chargeId: string;
    try {
      ({ chargeId } = await this.cardPayments.charge(request.cardToken, amount, order.id));
    } catch (e) {
      if (!(e instanceof PaymentProviderUnavailableError)) throw e;
      // Provider down: fall back to invoice, no card surcharge.
      const invoice = new Invoicing().invoiceFor(order);
      return {
        orderId: order.id,
        status: invoice.status,
        amount: invoice.amount.amount(),
        currency: invoice.amount.currency,
        reference: invoice.reference,
      };
    }
    return { orderId: order.id, status: 'paid', amount: amount.amount(), currency: amount.currency, reference: chargeId };
  }
}
