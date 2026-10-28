import { Production } from './Production';

export interface ProductionRepository {
  findById(id: string): Promise<Production | undefined>;
  save(production: Production): Promise<void>;
}
