import { CommissionRepositoryPort } from '../../../application/ports/out/commission-repository.port';
import { BellCommission } from '../../../domain/bell-commission';

export class InMemoryCommissionRepository implements CommissionRepositoryPort {
  private readonly rows = new Map<string, BellCommission>();

  async findById(id: string): Promise<BellCommission | null> {
    return this.rows.get(id) ?? null;
  }

  async findByLotRef(lotRef: string): Promise<BellCommission | null> {
    return [...this.rows.values()].find((c) => c.lotReference === lotRef) ?? null;
  }

  async save(commission: BellCommission): Promise<void> {
    this.rows.set(commission.id, commission);
  }
}
