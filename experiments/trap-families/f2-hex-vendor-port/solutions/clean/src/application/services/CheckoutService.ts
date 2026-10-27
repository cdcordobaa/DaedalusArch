import { PaymentsUnavailable } from '../../domain/errors/PaymentsUnavailable';
import type { DeclineReason } from '../../domain/model/CardCharge';
import { Order } from '../../domain/model/Order';
import type { Payment } from '../../domain/model/Payment';
import { CardPricing } from '../../domain/services/CardPricing';
import { Invoicing } from '../../domain/services/Invoicing';
import type { Checkout, CheckoutRequest, CheckoutView } from '../ports/in/Checkout';
import type { CardPayments } from '../ports/out/CardPayments';

const DECLINE_MESSAGES: Record<DeclineReason, string> = {
  'not-enough-funds': 'Your card has insufficient funds.',
  'card-expired': 'Your card has expired.',
  other: 'Your card was declined.',
};

export class CheckoutService implements Checkout {
  constructor(
    private readonly cards: CardPayments,
    private readonly pricing: CardPricing = new CardPricing(),
    private readonly invoicing: Invoicing = new Invoicing(),
  ) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutView> {
    const order = Order.of(request.orderId, request.total, request.currency);
    const payment = await this.byCardOrInvoice(order, request.cardToken);
    return {
      orderId: order.id,
      status: payment.status,
      amount: payment.amount.amount(),
      currency: payment.amount.currency,
      ...(payment.reference === undefined ? {} : { reference: payment.reference }),
      ...(payment.declineReason === undefined ? {} : { message: DECLINE_MESSAGES[payment.declineReason] }),
    };
  }

  private async byCardOrInvoice(order: Order, cardToken: string): Promise<Payment> {
    const amount = this.pricing.amountFor(order);
    try {
      const charge = await this.cards.charge(order, amount, cardToken);
      if (charge.outcome === 'accepted') return { status: 'paid', amount, reference: charge.reference };
      return { status: 'declined', amount, declineReason: charge.reason };
    } catch (e) {
      if (e instanceof PaymentsUnavailable) return this.invoicing.invoiceFor(order);
      throw e;
    }
  }
}
