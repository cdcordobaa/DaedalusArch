import { Money } from "../../shared-kernel/Money";

export interface PaymentGateway {
  send(payoutId: string, amount: Money): string;
  cancel(payoutId: string): void;
  refund(payoutId: string, amount: Money): void;
}
