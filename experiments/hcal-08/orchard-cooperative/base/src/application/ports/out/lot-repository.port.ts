import { HarvestLot } from '../../../domain/harvest-lot';

export interface LotRepositoryPort {
  findById(id: string): Promise<HarvestLot | null>;
  findByRunRef(runRef: string): Promise<HarvestLot | null>;
  save(lot: HarvestLot): Promise<void>;
}
