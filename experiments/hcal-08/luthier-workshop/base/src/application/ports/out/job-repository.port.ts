import { RepairJob } from '../../../domain/repair-job';

export interface JobRepositoryPort {
  findById(id: string): Promise<RepairJob | null>;
  findBySupplyRef(supplyRef: string): Promise<RepairJob | null>;
  save(job: RepairJob): Promise<void>;
}
