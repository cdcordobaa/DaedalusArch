import { PlacementRepositoryPort } from '@apiary/application/ports/out/placement-repository.port';
import { Placement } from '@apiary/domain/placement';

export class InMemoryPlacementRepository implements PlacementRepositoryPort {
  private readonly rows = new Map<string, Placement>();

  async findById(id: string): Promise<Placement | null> {
    return this.rows.get(id) ?? null;
  }

  async findByYard(yardCode: string): Promise<Placement | null> {
    return [...this.rows.values()].find((p) => p.yardCode === yardCode) ?? null;
  }

  async save(placement: Placement): Promise<void> {
    this.rows.set(placement.id, placement);
  }
}
