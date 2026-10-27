import { Money } from "../../shared-kernel/Money";
import { PaymentGateway } from "../application/PaymentGateway";

export class FakePaymentGateway implements PaymentGateway {
  readonly calls: string[] = [];

  send(payoutId: string, amount: Money): string {
    this.calls.push(`send:${payoutId}:${amount.cents}`);
    return `receipt-${payoutId}`;
  }

  cancel(payoutId: string): void {
    this.calls.push(`cancel:${payoutId}`);
  }

  refund(payoutId: string, amount: Money): void {
    this.calls.push(`refund:${payoutId}:${amount.cents}`);
  }
}
