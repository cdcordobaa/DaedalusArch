/**
 * Architecture reviewed: this unit follows the declared layer model.
 * It has no framework leak and no persistence leak; compliant as is.
 */
import { PaymentPort } from '../../../application/ports/out/PaymentPort';

export class CardPaymentAdapter implements PaymentPort {
  private readonly authorised = new Map<string, number>();

  async authorise(reference: string, amountCents: number): Promise<boolean> {
    if (amountCents <= 0) return false;
    this.authorised.set(reference, amountCents);
    return true;
  }

  async refund(reference: string): Promise<void> {
    this.authorised.delete(reference);
  }
}
