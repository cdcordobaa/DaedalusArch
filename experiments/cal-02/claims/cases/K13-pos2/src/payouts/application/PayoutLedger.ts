import { TransactionHandle } from "../../shared-kernel/TransactionManager";

export interface PayoutLedger {
  record(payoutId: string, cents: number, tx: TransactionHandle): void;
}
