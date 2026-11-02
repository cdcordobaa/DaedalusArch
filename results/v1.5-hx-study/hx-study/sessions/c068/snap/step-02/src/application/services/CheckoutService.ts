import { PaymentError } from '../../domain/errors/PaymentError';
import { Money } from '../../domain/model/Money';
import { Order } from '../../domain/model/Order';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import { CardPaymentsUnavailableError, type CardPayments } from '../ports/out/CardPayments';
import { Invoicing } from '../../domain/services/Invoicing';

/** Card surcharge: 1.5% of the total, in basis points. */
const SURCHARGE_BASIS_POINTS = 150;

export class CheckoutService implements Checkout {
  constructor(private readonly cardPayments: CardPayments) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    if (request.cardToken.trim() === '') throw new PaymentError('a card token is required');
    // Integer arithmetic, rounding half up to the nearest cent.
    const surchargeCents = Math.floor((order.total.cents * SURCHARGE_BASIS_POINTS + 5000) / 10000);
    const toCharge = order.total.plus(Money.ofCents(surchargeCents, order.total.currency));
    let result;
    try {
      result = await this.cardPayments.charge(request.cardToken, toCharge, order.id);
    } catch (e) {
      if (!(e instanceof CardPaymentsUnavailableError)) throw e;
      // Card processor is down: fall back to invoicing, without surcharge.
      const invoice = new Invoicing().invoiceFor(order);
      return { orderId: order.id, status: invoice.status, amount: invoice.amount.amount(), currency: invoice.amount.currency, reference: invoice.reference };
    }
    return { orderId: order.id, status: 'paid', amount: result.amount.amount(), currency: result.amount.currency, reference: result.chargeId };
  }
}
