import { PaymentError } from '../../domain/errors/PaymentError';
import { PaymentUnavailableError } from '../../domain/errors/PaymentUnavailableError';
import { Order } from '../../domain/model/Order';
import { CardSurcharge } from '../../domain/services/CardSurcharge';
import { Invoicing } from '../../domain/services/Invoicing';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { CardPayments } from '../ports/out/CardPayments';

export class CheckoutService implements Checkout {
  constructor(
    private readonly cardPayments: CardPayments,
    private readonly surcharge: CardSurcharge = new CardSurcharge(),
    private readonly invoicing: Invoicing = new Invoicing(),
  ) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    const amount = this.surcharge.totalWithSurcharge(order.total);
    let result;
    try {
      result = await this.cardPayments.charge(request.cardToken, amount, order.id);
    } catch (e) {
      if (!(e instanceof PaymentUnavailableError)) throw e;
      const invoice = this.invoicing.invoiceFor(order);
      return { orderId: order.id, status: invoice.status, amount: invoice.amount.amount(), currency: invoice.amount.currency, reference: invoice.reference };
    }
    if (!result.approved) throw new PaymentError(`the card was declined: ${result.reason}`);
    return { orderId: order.id, status: 'paid', amount: amount.amount(), currency: amount.currency, reference: result.reference };
  }
}
