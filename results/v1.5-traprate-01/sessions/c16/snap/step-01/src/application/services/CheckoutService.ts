import { PaymentError } from '../../domain/errors/PaymentError';
import { Money } from '../../domain/model/Money';
import { Order } from '../../domain/model/Order';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { Charges } from '../ports/out/Charges';

/** Card surcharge of 1.5%, expressed per thousand so the calculation stays in integers. */
const SURCHARGE_PER_THOUSAND = 15;

export class CheckoutService implements Checkout {
  constructor(private readonly charges: Charges) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    if (request.cardToken.trim() === '') throw new PaymentError('a card token is required');
    // Rounds half up to the nearest cent.
    const surcharge = Math.floor((order.total.cents * SURCHARGE_PER_THOUSAND + 500) / 1000);
    const charged = order.total.plus(Money.ofCents(surcharge, order.total.currency));
    const receipt = await this.charges.charge(request.cardToken, charged, order.id);
    return { orderId: order.id, status: 'paid', amount: charged.amount(), currency: charged.currency, reference: receipt.reference };
  }
}
