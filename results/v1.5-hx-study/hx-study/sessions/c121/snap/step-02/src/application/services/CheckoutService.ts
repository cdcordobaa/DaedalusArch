import { PaymentError } from '../../domain/errors/PaymentError';
import { Order } from '../../domain/model/Order';
import { Invoicing } from '../../domain/services/Invoicing';
import type { Payment } from '../../domain/model/Payment';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { CardPayments } from '../ports/out/CardPayments';

/** Our card surcharge: 1.5% of the order total, in basis points. */
const CARD_SURCHARGE_BASIS_POINTS = 150;

export class CheckoutService implements Checkout {
  constructor(private readonly cardPayments: CardPayments) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    if (request.cardToken.trim() === '') throw new PaymentError('a card token is required');
    const toCharge = order.total.plus(order.total.basisPoints(CARD_SURCHARGE_BASIS_POINTS));
    let payment: Payment;
    try {
      const charge = await this.cardPayments.charge(request.cardToken, toCharge, order.id);
      payment = { status: 'paid', amount: toCharge, reference: charge.reference };
    } catch (e) {
      if (e instanceof PaymentError) throw e; // a real decline is not an outage
      payment = new Invoicing().invoiceFor(order);
    }
    return { orderId: order.id, status: payment.status, amount: payment.amount.amount(), currency: payment.amount.currency, reference: payment.reference };
  }
}
