import { PaymentError } from '../../domain/errors/PaymentError';
import { PaymentsUnavailableError } from '../../domain/errors/PaymentsUnavailableError';
import { Invoicing } from '../../domain/services/Invoicing';
import { Money } from '../../domain/model/Money';
import { Order } from '../../domain/model/Order';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { Payments } from '../ports/out/Payments';

/** Card surcharge: 1.5% of the total, rounded to the nearest cent (integer math, halves up). */
function surchargeOn(total: Money): Money {
  return Money.ofCents(Math.floor((total.cents * 15 + 500) / 1000), total.currency);
}

export class CheckoutService implements Checkout {
  constructor(private readonly payments: Payments) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    if (request.cardToken.trim() === '') throw new PaymentError('a card token is required');
    const amount = order.total.plus(surchargeOn(order.total));
    let result;
    try {
      result = await this.payments.chargeCard(request.cardToken, amount, order.id);
    } catch (e) {
      if (e instanceof PaymentsUnavailableError) {
        const invoice = new Invoicing().invoiceFor(order);
        return {
          orderId: order.id,
          status: invoice.status,
          amount: invoice.amount.amount(),
          currency: invoice.amount.currency,
          reference: invoice.reference,
        };
      }
      throw e;
    }
    if (!result.approved) {
      throw new PaymentError(`card payment declined${result.declineReason ? `: ${result.declineReason}` : ''}`);
    }
    return { orderId: order.id, status: 'paid', amount: amount.amount(), currency: amount.currency, reference: result.reference };
  }
}
