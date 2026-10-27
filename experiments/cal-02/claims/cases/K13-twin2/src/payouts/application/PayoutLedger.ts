import { Money } from "../../shared-kernel/Money";

export interface PayoutLedger {
  record(payoutId: string, amount: Money): void;
}
