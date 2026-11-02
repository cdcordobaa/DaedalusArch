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
    // Card surcharge: 1.5% of the total, rounded to the nearest cent (integer math avoids float error).
    const surcharge = Money.ofCents(Math.round((order.total.cents * 15) / 1000), order.total.currency);
    const toCharge = order.total.plus(surcharge);
    const result = await this.charges.charge(request.cardToken, toCharge, order.id);
    if (!result.succeeded) throw new PaymentError(`card payment declined: ${result.reason}`);
    return { orderId: order.id, status: 'paid', amount: result.amount.amount(), currency: result.amount.currency, reference: result.chargeId };
  }
}
