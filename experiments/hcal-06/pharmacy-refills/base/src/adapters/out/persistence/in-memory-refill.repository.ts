import { RefillRepositoryPort } from '../../../application/ports/out/refill-repository.port';
import { Refill } from '../../../domain/refill';

export class InMemoryRefillRepository implements RefillRepositoryPort {
  private readonly rows = new Map<string, Refill>();

  async findById(id: string): Promise<Refill | null> {
    return this.rows.get(id) ?? null;
  }

  async save(refill: Refill): Promise<void> {
    this.rows.set(refill.id, refill);
  }
}
