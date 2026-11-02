import { PaymentError } from '../../domain/errors/PaymentError';
import { Order } from '../../domain/model/Order';
import { CardSurcharge } from '../../domain/services/CardSurcharge';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { CardPayments } from '../ports/out/CardPayments';

export class CheckoutService implements Checkout {
  constructor(
    private readonly cardPayments: CardPayments,
    private readonly surcharge: CardSurcharge = new CardSurcharge(),
  ) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    const amount = this.surcharge.totalWithSurcharge(order.total);
    const result = await this.cardPayments.charge(request.cardToken, amount, order.id);
    if (!result.approved) throw new PaymentError(`the card was declined: ${result.reason}`);
    return { orderId: order.id, status: 'paid', amount: amount.amount(), currency: amount.currency, reference: result.reference };
  }
}
