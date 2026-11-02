import { Order } from '../../domain/model/Order';
import { CardSurcharge } from '../../domain/services/CardSurcharge';
import { PaymentUnavailableError } from '../../domain/errors/PaymentUnavailableError';
import { Invoicing } from '../../domain/services/Invoicing';
import type { Payment } from '../../domain/model/Payment';
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
    let payment: Payment;
    try {
      const chargeId = await this.cardPayments.charge(order.id, amount, request.cardToken);
      payment = { status: 'paid', amount, reference: chargeId };
    } catch (e) {
      if (!(e instanceof PaymentUnavailableError)) throw e;
      payment = new Invoicing().invoiceFor(order);
    }
    return { orderId: order.id, status: payment.status, amount: payment.amount.amount(), currency: payment.amount.currency, reference: payment.reference };
  }
}
