import { PaymentError } from '../../domain/errors/PaymentError';
import { Order } from '../../domain/model/Order';
import { CardSurcharge } from '../../domain/services/CardSurcharge';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { CardPayments } from '../ports/out/CardPayments';

export class CheckoutService implements Checkout {
  constructor(private readonly cardPayments: CardPayments) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    if (request.cardToken.trim() === '') throw new PaymentError('a card token is required');
    const amount = CardSurcharge.chargeableFor(order.total);
    const result = await this.cardPayments.charge(order.id, amount, request.cardToken);
    if (!result.paid) throw new PaymentError(`card payment declined: ${result.reason}`);
    return { orderId: order.id, status: 'paid', amount: amount.amount(), currency: amount.currency, reference: result.reference };
  }
}
