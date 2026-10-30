import { PaymentDeclinedError, PaymentError, PaymentUnavailableError } from '../../domain/errors/PaymentError';
import { Money } from '../../domain/model/Money';
import { Order } from '../../domain/model/Order';
import { Invoicing } from '../../domain/services/Invoicing';
import type { Checkout,CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { Charges } from '../ports/out/Charges';

function declineMessage(reason: string | undefined): string {
  if (reason === 'insufficient_funds') return 'Your card has insufficient funds.';
  if (reason === 'expired_card') return 'Your card has expired.';
  return 'Your card was declined.';
}

export class CheckoutService implements Checkout {
  constructor(private readonly charges: Charges) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    if (request.cardToken.trim() === '') throw new PaymentError('a card token is required');
    // Card surcharge of 1.5% of the total, rounded to the nearest cent (integer arithmetic).
    const surcharge = Math.floor((order.total.cents * 15 + 500) / 1000);
    const amount = order.total.plus(Money.ofCents(surcharge, order.total.currency));
    let reference: string;
    try {
      reference = (await this.charges.charge(request.cardToken, amount, order.id)).reference;
    } catch (e) {
      if (e instanceof PaymentDeclinedError) {
        return {
          orderId: order.id,
          status: 'declined',
          amount: order.total.amount(),
          currency: order.total.currency,
          message: declineMessage(e.reason),
        };
      }
      if (!(e instanceof PaymentUnavailableError)) throw e;
      // Card processor is down: fall back to invoice, without surcharge.
      const invoice = new Invoicing().invoiceFor(order);
      return {
        orderId: order.id,
        status: invoice.status,
        amount: invoice.amount.amount(),
        currency: invoice.amount.currency,
        reference: invoice.reference,
      };
    }
    return { orderId: order.id, status: 'paid', amount: amount.amount(), currency: amount.currency, reference };
  }
}
