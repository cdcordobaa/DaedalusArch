import { PaymentError } from '../../domain/errors/PaymentError';
import { PaymentUnavailableError } from '../../domain/errors/PaymentUnavailableError';
import { Order } from '../../domain/model/Order';
import { invoiceReference } from '../../domain/services/Invoicing';
import type { Payment } from '../../domain/model/Payment';
import { withCardSurcharge } from '../../domain/services/CardSurcharge';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { Charges } from '../ports/out/Charges';

export class CheckoutService implements Checkout {
  constructor(private readonly charges: Charges) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    if (request.cardToken.trim() === '') throw new PaymentError('a card token is required');
    const amount = withCardSurcharge(order.total);
    let reference: string;
    try {
      reference = await this.charges.charge(request.cardToken, amount, order.id);
    } catch (e) {
      if (!(e instanceof PaymentUnavailableError)) throw e;
      return { orderId: order.id, status: 'invoiced', amount: order.total.amount(), currency: order.total.currency, reference: invoiceReference(order.id) };
    }
    const payment: Payment = { status: 'paid', amount, reference };
    return { orderId: order.id, status: payment.status, amount: payment.amount.amount(), currency: payment.amount.currency, reference: payment.reference };
  }
}
