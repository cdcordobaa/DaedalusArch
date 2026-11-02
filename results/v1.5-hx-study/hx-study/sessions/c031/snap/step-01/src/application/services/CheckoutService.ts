import { PaymentError } from '../../domain/errors/PaymentError';
import { Order } from '../../domain/model/Order';
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
    const charge = await this.cards.charge(request.cardToken, toCharge, order.id);
    return { orderId: order.id, status: 'paid', amount: charge.amount.amount(), currency: charge.amount.currency, reference: charge.reference };
  }
}
