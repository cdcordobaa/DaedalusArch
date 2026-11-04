import { BellCommission } from '../../../domain/bell-commission';

export interface CommissionRepositoryPort {
  findById(id: string): Promise<BellCommission | null>;
  findByLotRef(lotRef: string): Promise<BellCommission | null>;
  save(commission: BellCommission): Promise<void>;
}
