import { Order } from '../../domain/model/Order';
import { PaymentUnavailableError } from '../../domain/errors/PaymentUnavailableError';
import { Invoicing } from '../../domain/services/Invoicing';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { CardPayments } from '../ports/out/CardPayments';

/** Our card surcharge: 1.5% of the order total, in basis points. */
const CARD_SURCHARGE_BASIS_POINTS = 150;

export class CheckoutService implements Checkout {
  constructor(private readonly cardPayments: CardPayments) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    const toCharge = order.total.plus(order.total.basisPoints(CARD_SURCHARGE_BASIS_POINTS));
    let payment;
    try {
      payment = await this.cardPayments.charge(order.id, toCharge, request.cardToken);
    } catch (e) {
      if (!(e instanceof PaymentUnavailableError)) throw e;
      payment = new Invoicing().invoiceFor(order);
    }
    return { orderId: order.id, status: payment.status, amount: payment.amount.amount(), currency: payment.amount.currency, reference: payment.reference };
  }
}
