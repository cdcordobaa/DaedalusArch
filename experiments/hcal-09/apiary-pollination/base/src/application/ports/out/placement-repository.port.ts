import { Placement } from '../../../domain/placement';

export interface PlacementRepositoryPort {
  findById(id: string): Promise<Placement | null>;
  findByYard(yardCode: string): Promise<Placement | null>;
  save(placement: Placement): Promise<void>;
}
