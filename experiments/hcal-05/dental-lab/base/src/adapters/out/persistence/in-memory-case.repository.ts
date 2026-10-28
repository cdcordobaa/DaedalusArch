import { CaseRepositoryPort } from '../../../application/ports/out/case-repository.port';
import { CaseOrder } from '../../../domain/case-order';

export class InMemoryCaseRepository implements CaseRepositoryPort {
  private readonly store = new Map<string, CaseOrder>();

  async save(order: CaseOrder): Promise<void> { this.store.set(order.id, order); }
  async findById(id: string): Promise<CaseOrder | null> { return this.store.get(id) ?? null; }
}
