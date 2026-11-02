import { PaymentError } from '../../domain/errors/PaymentError';
import { Money } from '../../domain/model/Money';
import { Order } from '../../domain/model/Order';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { CardPayments } from '../ports/out/CardPayments';

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
    const result = await this.cardPayments.charge(request.cardToken, toCharge, order.id);
    return { orderId: order.id, status: 'paid', amount: result.amount.amount(), currency: result.amount.currency, reference: result.chargeId };
  }
}
