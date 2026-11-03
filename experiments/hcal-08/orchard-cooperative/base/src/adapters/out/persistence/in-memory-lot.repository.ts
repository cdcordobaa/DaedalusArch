import { LotRepositoryPort } from '../../../application/ports/out/lot-repository.port';
import { HarvestLot } from '../../../domain/harvest-lot';

export class InMemoryLotRepository implements LotRepositoryPort {
  private readonly rows = new Map<string, HarvestLot>();

  async findById(id: string): Promise<HarvestLot | null> {
    return this.rows.get(id) ?? null;
  }

  async findByRunRef(runRef: string): Promise<HarvestLot | null> {
    return [...this.rows.values()].find((l) => l.pressRunReference === runRef) ?? null;
  }

  async save(lot: HarvestLot): Promise<void> {
    this.rows.set(lot.id, lot);
  }
}
