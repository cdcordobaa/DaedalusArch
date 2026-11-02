import { PaymentError, PaymentServiceUnavailableError } from '../../domain/errors/PaymentError';
import { Order } from '../../domain/model/Order';
import { totalWithCardSurcharge } from '../../domain/services/CardSurcharge';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { CardPayments } from '../ports/out/CardPayments';

export class CheckoutService implements Checkout {
  constructor(private readonly cardPayments: CardPayments) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    if (request.cardToken.trim() === '') throw new PaymentError('a card token is required');
    let payment;
    try {
      payment = await this.cardPayments.charge(order.id, request.cardToken, totalWithCardSurcharge(order.total));
    } catch (e) {
      if (!(e instanceof PaymentServiceUnavailableError)) throw e;
      // Paystream is down: fall back to invoicing, without the card surcharge.
      return { orderId: order.id, status: 'invoiced', amount: order.total.amount(), currency: order.total.currency, reference: `INV-${order.id}` };
    }
    return { orderId: order.id, status: payment.status, amount: payment.amount.amount(), currency: payment.amount.currency, reference: payment.reference };
  }
}
