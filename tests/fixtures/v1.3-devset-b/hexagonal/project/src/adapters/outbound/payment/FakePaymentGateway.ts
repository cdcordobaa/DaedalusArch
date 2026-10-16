import { PaymentGateway } from '../../../application/ports/out/PaymentGateway';
import { BookingError } from '../../../domain/errors/BookingError';
import { Money } from '../../../domain/model/Money';

export const PAYMENT_FEE_CENTS = 150;

/** Driven adapter standing in for a card processor; declines charges above a fixed limit. */
export class FakePaymentGateway implements PaymentGateway {
  private readonly charges = new Map<string, number>();

  async charge(guestId: string, amount: Money): Promise<string> {
    if (amount.cents > 500_000) throw new BookingError('payment-declined', `Charge for ${guestId} declined`);
    const ref = `pay-${this.charges.size + 1}`;
    this.charges.set(ref, amount.cents);
    return ref;
  }

  async refund(paymentRef: string): Promise<void> {
    this.charges.delete(paymentRef);
  }
}
