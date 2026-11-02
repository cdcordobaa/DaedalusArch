import { PaymentError } from '../../domain/errors/PaymentError';
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
    const receipt = await this.cards.charge(request.cardToken, withCardSurcharge(order.total), order.id);
    return { orderId: order.id, status: 'paid', amount: receipt.amount.amount(), currency: receipt.amount.currency, reference: receipt.reference };
  }
}
