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
    if (request.cardToken.trim() === '') throw new PaymentError('a card token is required');
    const toCharge = this.surcharge.totalToCharge(order.total);
    const charge = await this.cardPayments.charge(request.cardToken, toCharge, order.id);
    return { orderId: order.id, status: 'paid', amount: charge.amount.amount(), currency: charge.amount.currency, reference: charge.reference };
  }
}
