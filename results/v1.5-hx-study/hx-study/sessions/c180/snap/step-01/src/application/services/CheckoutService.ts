import { Order } from '../../domain/model/Order';
import { CardSurcharge } from '../../domain/services/CardSurcharge';
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
    const charge = await this.charges.charge(request.cardToken, amount, order.id);
    return { orderId: order.id, status: 'paid', amount: amount.amount(), currency: amount.currency, reference: charge.reference };
  }
}
