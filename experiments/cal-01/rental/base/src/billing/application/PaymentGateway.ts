import { Money } from "../../shared-kernel/Money";

export interface PaymentGateway {
  capture(chargeId: string, amount: Money): Promise<string>;
  refund(chargeId: string, amount: Money): Promise<void>;
  sendReceipt(chargeId: string): Promise<void>;
}
