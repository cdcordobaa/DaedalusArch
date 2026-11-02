import { Order } from '../../domain/model/Order';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { CardPayments } from '../ports/out/CardPayments';

/** Card surcharge in tenths of a percent: 15 = 1.5%. */
const CARD_SURCHARGE_TENTHS_PERCENT = 15;

export class CheckoutService implements Checkout {
  constructor(private readonly cardPayments: CardPayments) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    const amount = order.total.plusSurcharge(CARD_SURCHARGE_TENTHS_PERCENT);
    const charge = await this.cardPayments.charge(request.cardToken, amount, order.id);
    return { orderId: order.id, status: 'paid', amount: amount.amount(), currency: amount.currency, reference: charge.reference };
  }
}
