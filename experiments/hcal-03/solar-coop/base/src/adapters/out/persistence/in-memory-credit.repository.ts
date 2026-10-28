import { CreditRepository } from '../../../application/ports/out/credit-repository.port';
import { ProductionCredit } from '../../../domain/production-credit';
import { MemoryDb } from './memory-db';

export class InMemoryCreditRepository implements CreditRepository {
  constructor(private readonly db: MemoryDb) {}
  async save(credit: ProductionCredit): Promise<void> {
    this.db.credits.set(credit.id, credit);
  }
  async findByMember(memberId: string): Promise<ProductionCredit[]> {
    return [...this.db.credits.values()].filter((c) => c.memberId === memberId);
  }
}
