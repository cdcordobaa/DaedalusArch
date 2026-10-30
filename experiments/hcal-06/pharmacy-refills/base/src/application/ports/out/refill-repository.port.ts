import { Refill } from '../../../domain/refill';

export interface RefillRepositoryPort {
  findById(id: string): Promise<Refill | null>;
  save(refill: Refill): Promise<void>;
}
