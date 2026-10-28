import { Order } from '../../domain/model/Order';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { Charges } from '../ports/out/Charges';

/** Card surcharge in basis points (1.5%). */
const CARD_SURCHARGE_BASIS_POINTS = 150;

export class CheckoutService implements Checkout {
  constructor(private readonly charges: Charges) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    const amount = order.total.plusSurcharge(CARD_SURCHARGE_BASIS_POINTS);
    const receipt = await this.charges.charge(request.cardToken, amount, order.id);
    return { orderId: order.id, status: 'paid', amount: amount.amount(), currency: amount.currency, reference: receipt.reference };
  }
}
