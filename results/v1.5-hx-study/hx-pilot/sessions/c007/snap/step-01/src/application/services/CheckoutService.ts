import { PaymentError } from '../../domain/errors/PaymentError';
import { Money } from '../../domain/model/Money';
import { Order } from '../../domain/model/Order';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { Charges } from '../ports/out/Charges';

export class CheckoutService implements Checkout {
  constructor(private readonly charges: Charges) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    if (request.cardToken.trim() === '') throw new PaymentError('a card token is required');
    // Card surcharge of 1.5% of the total, rounded to the nearest cent (integer arithmetic).
    const surcharge = Math.floor((order.total.cents * 15 + 500) / 1000);
    const amount = order.total.plus(Money.ofCents(surcharge, order.total.currency));
    const { reference } = await this.charges.charge(request.cardToken, amount, order.id);
    return { orderId: order.id, status: 'paid', amount: amount.amount(), currency: amount.currency, reference };
  }
}
