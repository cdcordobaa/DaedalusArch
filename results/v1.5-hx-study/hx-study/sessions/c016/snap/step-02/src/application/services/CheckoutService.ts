import { PaymentUnavailableError } from '../../domain/errors/PaymentUnavailableError';
import { Order } from '../../domain/model/Order';
import type { Payment } from '../../domain/model/Payment';
import { CardSurcharge } from '../../domain/services/CardSurcharge';
import { Invoicing } from '../../domain/services/Invoicing';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { CardPayments } from '../ports/out/CardPayments';

export class CheckoutService implements Checkout {
  constructor(private readonly cardPayments: CardPayments) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    let payment: Payment;
    try {
      payment = await this.cardPayments.charge(request.cardToken, CardSurcharge.totalWithSurcharge(order.total), order.id);
    } catch (e) {
      if (!(e instanceof PaymentUnavailableError)) throw e;
      payment = new Invoicing().invoiceFor(order);
    }
    return { orderId: order.id, status: payment.status, amount: payment.amount.amount(), currency: payment.amount.currency, reference: payment.reference };
  }
}
