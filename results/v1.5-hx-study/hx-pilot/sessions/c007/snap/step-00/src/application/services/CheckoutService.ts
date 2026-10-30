import { Order } from '../../domain/model/Order';
import { Invoicing } from '../../domain/services/Invoicing';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';

export class CheckoutService implements Checkout {
  constructor(private readonly invoicing: Invoicing = new Invoicing()) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    const payment = this.invoicing.invoiceFor(order);
    return { orderId: order.id, status: payment.status, amount: payment.amount.amount(), currency: payment.amount.currency, reference: payment.reference };
  }
}
