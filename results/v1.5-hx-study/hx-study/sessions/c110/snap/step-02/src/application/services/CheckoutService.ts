import { PaymentError, PaymentProviderUnavailableError } from '../../domain/errors/PaymentError';
import { Invoicing } from '../../domain/services/Invoicing';
import { Order } from '../../domain/model/Order';
import { CardSurcharge } from '../../domain/services/CardSurcharge';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { Charges } from '../ports/out/Charges';

export class CheckoutService implements Checkout {
  constructor(
    private readonly charges: Charges,
    private readonly surcharge: CardSurcharge = new CardSurcharge(),
  ) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    if (request.cardToken.trim() === '') throw new PaymentError('a card token is required');
    const amount = this.surcharge.applyTo(order.total);
    let receipt;
    try {
      receipt = await this.charges.charge(request.cardToken, amount, order.id);
    } catch (e) {
      if (!(e instanceof PaymentProviderUnavailableError)) throw e;
      const invoice = new Invoicing().invoiceFor(order);
      return { orderId: order.id, status: invoice.status, amount: invoice.amount.amount(), currency: invoice.amount.currency, reference: invoice.reference };
    }
    if (!receipt.approved) throw new PaymentError(`card declined${receipt.declineReason ? `: ${receipt.declineReason}` : ''}`);
    return { orderId: order.id, status: 'paid', amount: receipt.amount.amount(), currency: receipt.amount.currency, reference: receipt.chargeId };
  }
}
