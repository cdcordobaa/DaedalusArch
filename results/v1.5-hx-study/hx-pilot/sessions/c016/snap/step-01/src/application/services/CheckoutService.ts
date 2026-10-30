import { Order } from '../../domain/model/Order';
import type { Payment } from '../../domain/model/Payment';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { CardPayments } from '../ports/out/CardPayments';

/** Card surcharge in tenths of a percent: 15 is 1.5%. */
const CARD_SURCHARGE_PER_MILLE = 15;

export class CheckoutService implements Checkout {
  constructor(private readonly cardPayments: CardPayments) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    const amount = order.total.withSurchargePerMille(CARD_SURCHARGE_PER_MILLE);
    const charge = await this.cardPayments.charge(order.id, amount, request.cardToken);
    const payment: Payment = { status: 'paid', amount, reference: charge.reference };
    return { orderId: order.id, status: payment.status, amount: payment.amount.amount(), currency: payment.amount.currency, reference: payment.reference };
  }
}
