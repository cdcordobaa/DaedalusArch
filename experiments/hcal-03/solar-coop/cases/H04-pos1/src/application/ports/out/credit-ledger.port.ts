import type { MemoryTx } from '../../../adapters/out/persistence/memory-db';
import { ProductionCredit } from '../../../domain/production-credit';

export interface CreditLedger {
  append(credit: ProductionCredit, tx: MemoryTx): Promise<void>;
}
