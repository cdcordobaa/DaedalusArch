import type { CreditLine } from '../../../../domain/model/office/CreditLine';

export interface CreditLedger {
  line(clientId: string): Promise<CreditLine | undefined>;
  keep(line: CreditLine): Promise<void>;
}
