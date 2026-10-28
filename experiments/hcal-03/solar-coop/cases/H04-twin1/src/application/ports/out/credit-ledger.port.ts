import { ProductionCredit } from '../../../domain/production-credit';

export interface CreditLedger {
  append(credit: ProductionCredit): Promise<void>;
  inTransaction<T>(work: () => Promise<T>): Promise<T>;
}
