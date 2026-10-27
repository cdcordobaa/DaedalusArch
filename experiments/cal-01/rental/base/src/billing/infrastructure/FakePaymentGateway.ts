import { Money } from "../../shared-kernel/Money";
import { PaymentGateway } from "../application/PaymentGateway";

export class FakePaymentGateway implements PaymentGateway {
  readonly calls: string[] = [];

  async capture(chargeId: string, amount: Money): Promise<string> {
    this.calls.push(`capture:${chargeId}:${amount.cents}`);
    return `receipt-${chargeId}`;
  }

  async refund(chargeId: string, amount: Money): Promise<void> {
    this.calls.push(`refund:${chargeId}:${amount.cents}`);
  }

  async sendReceipt(chargeId: string): Promise<void> {
    this.calls.push(`receipt:${chargeId}`);
  }
}
